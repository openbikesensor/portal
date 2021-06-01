# Copyright (C) 2020-2021 OpenBikeSensor Contributors
# Contact: https://openbikesensor.org
#
# This file is part of the OpenBikeSensor Scripts Collection.
#
# The OpenBikeSensor Scripts Collection is free software: you can redistribute it and/or
# modify it under the terms of the GNU Lesser General Public License as
# published by the Free Software Foundation, either version 3 of the License,
# or (at your option) any later version.
#
# The OpenBikeSensor Scripts Collection is distributed in the hope that it will be
# useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser
# General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public License
# along with the OpenBikeSensor Scripts Collection.  If not, see
# <http://www.gnu.org/licenses/>.

import csv
from tzwhere import tzwhere
import numpy as np
import pytz
import datetime
import math
import sys
from haversine import haversine, Unit

import urllib

from obs.face.mapping import AzimuthalEquidistant as LocalMap


class ImportMeasurementsCsv:
    def __init__(self,
                 right_hand_traffic=True,
                 derive_missing_velocities=True,
                 correct_timezone=False,
                 left_right_is_swapped=False,
                 case_is_left=True
    ):

        self.derive_missing_velocities = derive_missing_velocities
        self.correct_timezone = correct_timezone
        self.left_is_overtaker_side = left_right_is_swapped != right_hand_traffic
        self.case_is_overtaker_side = case_is_left == right_hand_traffic

        self.reject_measurements_before = datetime.datetime(2018, 1, 1, tzinfo=datetime.timezone.utc)

        self.measurement_template = {'time': None, 'latitude': None, 'longitude': None,
                                     'distance_overtaker': None, 'distance_stationary': None, 'confirmed': None,
                                     'course': None, 'speed': None,
                                     'in_privacy_zone': None
                                     }

        if self.correct_timezone:
            self.timezone_lookup = tzwhere.tzwhere(forceTZ=False)

    def read(self, filename, user_id="unknown", dataset_id="unknown", log=sys.stdout):
        log.write("importing {}\n".format(filename))

        measurements = self.read_csv(filename, user_id, dataset_id, log)
        n = len(measurements)
        log.write("read {} measurements\n".format(len(measurements)))

        if self.correct_timezone:
            log.write("correcting timezones\n")
            self.correct_measurement_timezones(measurements, log)

        if self.derive_missing_velocities:
            log.write("deriving missing velocities\n")
            self.derive_velocity(measurements, log)

        stats = self.compute_statistics(measurements)

        log.write("Statistics:\n")
        log.write("total files:            {}\n".format(stats["n_files"]))
        log.write("total measurements:     {}\n".format(stats["n_measurements"]))
        log.write("valid measurements:     {}\n".format(stats["n_valid"]))
        log.write("confirmed measurements: {}\n".format(stats["n_confirmed"]))
        log.write("time range:             {} to {}\n".format(stats["t_min"], stats["t_max"]))
        log.write("continuous time:        {}s\n".format(stats["t"]))
        log.write("continuous distance:    {}m\n".format(stats["d"]))
        log.write("continuous segments:    {}\n".format(stats["n_segments"]))

        return measurements, stats

    def read_csv(self, filename, user_id, dataset_id, log=sys.stdout):
        measurements = []
        try:
            with open(filename) as file:
                reader = csv.reader(file, delimiter=';')
                line_count = 0
                metadata_uninitialized = True
                format_uninitialized = True
                for line in reader:
                    line_count += 1
                    if format_uninitialized:
                        if metadata_uninitialized:
                            try:
                                metadata = urllib.parse.parse_qs(line[0], strict_parsing=True)
                                metadata_uninitialized = False
                                continue
                            except ValueError:
                                metadata = {}

                        format_id = self.identify_format(line, metadata)
                        log.write("file identified as format version {}\n".format(format_id))
                        if format_id in ["1.0", "1.1", "1.2", "1.3"]:
                            extractors = self.create_field_extractors_v1(line, metadata, format_id)
                            format_uninitialized = False
                        elif format_id in ["2"]:
                            extractors = self.create_field_extractors_v2(line, metadata, format_id)
                            format_uninitialized = False
                        else:
                            raise ValueError("unsupported format {}".format(metadata["OBSDataFormat"][0]))
                    else:
                        measurement = {
                            "user_id": user_id,
                            "measurement_id": dataset_id + ":" + str(line_count),
                        }

                        measurement = {**measurement, **self.measurement_template}
                        for e in extractors:
                            e.apply(line, measurement)

                        measurements.append(measurement)

        except csv.Error as e:
            log.write("error while reading CSV in line {}: {}".format(line_count, e))
            raise ValueError("error while reading CSV in line {}: {}".format(line_count, e))

        return measurements

    @staticmethod
    def identify_format(header, metadata):
        if "OBSDataFormat" in metadata:
            format_version = metadata["OBSDataFormat"][0]
        else:
            # this is a pre-v2 version
            if "Case" in header and "Lid" in header:
                if not ("Course" in header and "Speed" in header):
                    format_version = "1.0"
                else:
                    format_version = "1.1"
            elif "Left" in header and "Right" in header:
                if not ("insidePrivacyArea" in header):
                    format_version = "1.2"
                else:
                    format_version = "1.3"
            else:
                raise ValueError("unknown file format")
        return format_version

    def correct_measurement_timezones(self, measurements, log=sys.stdout):
        for m in measurements:
            t = m["time"]
            lat = m["latitude"]
            lon = m["longitude"]
            if all(v is not None for v in [t, lat, lon]):
                timezone_name = self.timezone_lookup.tzNameAt(lat, lon)
                if timezone_name is None:
                    # no timezone is found, keep UTC
                    log.write("ERROR: no timezone found for coordinates {} {} in ".format(lat, lon, m["measurement_id"]))
                else:
                    timezone = pytz.timezone(timezone_name)
                    # this timezone conversion is required, as the pytz.timezone object could not be
                    # exported using jsons
                    timezone2 = datetime.timezone(timezone.utcoffset(t.replace(tzinfo=None)),
                                                  name=timezone_name)
                    # now correct the timezone
                    m["time"] = t.astimezone(timezone2)

    def derive_velocity(self, measurements, log):
        n = len(measurements)
        l = 3  # filter window ssize must be odd
        a = (l - 1) // 2
        p = [(False, 0, 0)] * l
        t_prev = None
        n_valid = 0

        n_speed_derived = 0
        n_direction_derived = 0
        n_derived = 0

        for i in range(-a, n):
            j = i + a
            if j < n:
                m = measurements[j]
                t_j = m["time"]
                lat_j = m["latitude"]
                lon_j = m["longitude"]
                if lat_j is None or lon_j is None:
                    t_j = None
                valid = t_prev is not None and t_j is not None and (t_j - t_prev == datetime.timedelta(seconds=1))

                p_j = (valid, m["latitude"], m["longitude"])
            else:
                p_j = (False, 0, 0)
                t_j = None

            # remove oldest element
            n_valid -= p[0][0]
            p.pop(0)

            # add newest element
            p.append(p_j)
            n_valid += p_j[0]

            # keep track of old time
            t_prev = t_j
            # p now holds elements i-a to i+a

            # write filter results
            if i >= 0:
                # check validity
                if n_valid == l and (measurements[i]["course"] is None or measurements[i]["speed"] is None):
                    # all elements are valid
                    # transfer to a local map around middle element
                    xy, local_map = self.to_local_tangent(p)
                    # approximate derivative vector
                    v = 0.5 * (xy[2] - xy[0])
                    # compute compass direction
                    if measurements[i]["course"] is None:
                        measurements[i]["course"] = local_map.get_local_direction(v)
                        n_direction_derived += 1
                    if measurements[i]["speed"] is None:
                        measurements[i]["speed"] = np.linalg.norm(v)
                        n_speed_derived += 1
                    n_derived += 1
                    measurements[i]["egomotion_is_derived"] = True
                else:
                    measurements[i]["egomotion_is_derived"] = False
        log.write("{} measurements processed, derived values for {} measurements (speed: {}, course: {})\n".format(
            len(measurements), n_derived, n_speed_derived, n_direction_derived))

    @staticmethod
    def to_local_tangent(p):
        c = (len(p) - 1) // 2
        local_map = LocalMap(p[c][1], p[c][2])
        r = [local_map.transfer_to(q[1], q[2]) for q in p]
        return r, local_map

    @staticmethod
    def compute_statistics(measurements):
        n = 0
        n_valid = 0
        n_confirmed = 0
        t_min = None
        t_max = None
        t_cont = 0
        t_cont_min = None
        t_cont_max = None
        d_cont = 0
        n_cont = 0

        t_prev = None
        p_prev = None

        for m in measurements:
            valid = m["longitude"] is not None and m["latitude"] is not None and m["time"] is not None
            confirmed = valid and (m["confirmed"] is True)
            n += 1
            n_valid += valid
            n_confirmed += confirmed

            # time
            t = m["time"]
            if t is not None:
                # overall minimum and maximum
                if t_min is None or t < t_min:
                    t_min = t
                if t_max is None or t > t_max:
                    t_max = t

            # continuous and valid segments
            if valid:
                p = [m["latitude"], m["longitude"]]
                # also find continuous trajectories
                if t_prev is not None and p_prev is not None:
                    dt = t - t_prev
                    dt = dt.total_seconds()

                    dp = haversine(p, p_prev, unit=Unit.METERS)

                    # consider the track broken if:
                    # - there is a gap of more than 10s
                    # - the average speed is larger than 100 km/h
                    # - the time step is small (near 0), and the distance is largen than 100 km/h * 1s
                    if dt >= 60 or (dt >= 0.5 and dp >= abs(dt * 100.0/3.6)) or (dt <= 0.5 and dp >= 100/3.6):
                        if t_cont_min is not None and t_cont_max is not None:
                            dt = t_cont_max - t_cont_min
                            t_cont += dt.total_seconds()
                        t_cont_min = None
                        t_cont_max = None
                        n_cont += 1
                    else:
                        d_cont += dp

                    if t_cont_min is None or t < t_cont_min:
                        t_cont_min = t
                    if t_cont_max is None or t > t_cont_max:
                        t_cont_max = t

                t_prev = t
                p_prev = p

        if t_min is not None and t_max is not None:
            t_total = t_max - t_min
            t_total = t_total.total_seconds()
            n_cont += 1
        else:
            t_total = 0

        if t_cont_min is not None and t_cont_max is not None:
            dt = t_cont_max - t_cont_min
            t_cont += dt.total_seconds()

        stats = {
            "n_files": 1,
            "n_measurements": n,
            "n_valid": n_valid,
            "n_confirmed": n_confirmed,
            "t_min": t_min,
            "t_max": t_max,
            "t_total": t_total,
            "n_segments": n_cont,
            "t": t_cont,
            "d": d_cont
        }
        return stats

    def create_field_extractors_v1(self, header, metadata, format_id):
        extractors = [
            CsvExtractor(["Date", "Time"], "time",
                         lambda date, time:
                         datetime.datetime.strptime(
                             date + " " + time,
                             '%d.%m.%Y %H:%M:%S').replace(tzinfo=datetime.timezone.utc),
                         reject=lambda t: t < self.reject_measurements_before,
                         default=None, required=True
                         ),
            CsvExtractor(["Latitude", "Longitude"], ["latitude", "longitude"],
                         lambda lat, lon: [float(lat), float(lon)],
                         accept=lambda lat_, lon_: abs(lat_) <= 90.0 and
                                                   abs(lon_) <= 180.0,
                         reject=lambda lat_, lon_: lat_ == 0.0 and lon_ == 0.0,
                         default=[None, None], required=True),
            CsvExtractor("Confirmed", "confirmed",
                         lambda v: int(v) > 0,
                         default=[None, None], required=True),
        ]

        if format_id in ["1.1", "1.2", "1.3"]:
            extractors += [
                CsvExtractor("Course", "course",
                             lambda v: (math.pi/180.0*(90.0 - float(v))) % (2*math.pi),
                             accept=lambda v: math.isfinite(v),
                             default=None, required=True),
                CsvExtractor("Speed", "speed",
                             lambda v: float(v) / 3.6,
                             accept=lambda v: 0.0 <= v,
                             default=None, required=True),
                ]

        if format_id in ["1.0", "1.1"]:
            extractors += [
                CsvExtractor("Case" if self.case_is_overtaker_side else "Lid", "distance_overtaker",
                             lambda v: float(v) * 1e-2,
                             reject_raw=lambda v: v is None or int(v) == 255,
                             accept=lambda v: v >= 0,
                             default=None, required=True),
                CsvExtractor("Lid" if self.case_is_overtaker_side else "Case", "distance_stationary",
                             lambda v: float(v) * 1e-2,
                             reject_raw=lambda v: v is None or int(v) == 255,
                             accept=lambda v: v >= 0,
                             default=None, required=True),
                ]
        elif format_id in ["1.2"]:
            extractors += [
                CsvExtractor("Left" if self.left_is_overtaker_side else "Right", "distance_overtaker",
                             lambda v: float(v) * 1e-2,
                             reject_raw=lambda v: v is None or int(v) == 255,
                             accept=lambda v: v >= 0,
                             default=None, required=True),
                CsvExtractor("Right" if self.left_is_overtaker_side else "Left", "distance_stationary",
                             lambda v: float(v) * 1e-2,
                             reject_raw=lambda v: v is None or int(v) == 255,
                             accept=lambda v: v >= 0,
                             default=None, required=True),
                ]
        else:
            extractors += [
                CsvExtractor("Left" if self.left_is_overtaker_side else "Right", "distance_overtaker",
                             lambda v: float(v) * 1e-2,
                             reject_raw=lambda v: v is None or int(v) == 255 or int(v) == 999,
                             accept=lambda v: v >= 0,
                             default=None, required=True),
                CsvExtractor("Right" if self.left_is_overtaker_side else "Left", "distance_stationary",
                             lambda v: float(v) * 1e-2,
                             reject_raw=lambda v: v is None or int(v) == 255 or int(v) == 999,
                             accept=lambda v: v >= 0,
                             default=None, required=True),
                ]

        if format_id in "1.3":
            extractors += CsvExtractor("insidePrivacyArea", "in_privacy_zone",
                                       lambda v: int(v) == 1,
                                       default=None, required=True),

        for e in extractors:
            e.set_header(header)

        return extractors

    def create_field_extractors_v2(self, header, metadata, format_id):
        raw_n_max = int(metadata["MaximumMeasurementsPerLine"][0])
        extractors = [
            CsvExtractor(["Date", "Time"], "time",
                         lambda date, time:
                         datetime.datetime.strptime(
                             date + " " + time,
                             '%d.%m.%Y %H:%M:%S').replace(tzinfo=datetime.timezone.utc),
                         reject=lambda t: t < self.reject_measurements_before,
                         default=None, required=True
                         ),
            CsvExtractor("Millis", "time_system",
                         lambda ms: float(ms)*1e-3,
                         default=None, required=True),
            CsvExtractor("Comment", "comment",
                         lambda v: str(v),
                         default=None, required=True),
            CsvExtractor(["Latitude", "Longitude"], ["latitude", "longitude"],
                         lambda lat, lon: [float(lat), float(lon)],
                         accept=lambda lat_, lon_: abs(lat_) <= 90.0 and
                                                   abs(lon_) <= 180.0,
                         default=[None, None], required=True),
            CsvExtractor("Altitude", "altitude",
                         lambda v: float(v),
                         accept=lambda v: -9999.9 <= v <= 17999.9,
                         default=None, required=True),
            CsvExtractor("Course", "course",
                         lambda v: (math.pi/180.0*(90.0 - float(v))) % (2*math.pi),
                         accept=lambda v: math.isfinite(v),
                         default=None, required=True),
            CsvExtractor("Speed", "speed",
                         lambda v: float(v) / 3.6,
                         accept=lambda v: 0.0 <= v,
                         default=None, required=True),
            CsvExtractor("HDOP", "GPS_HDOP",
                         lambda v: float(v) ,
                         accept=lambda v: 0.0 <= v,
                         default=None, required=True),
            CsvExtractor("Satellites", "GPS_satellites",
                         lambda v: int(v),
                         accept=lambda v: 0.0 <= v,
                         default=None, required=True),
            CsvExtractor("BatteryLevel", "battery_level",
                         lambda v: float(v),
                         accept=lambda v: 0.0 <= v <= 9.99,
                         default=None, required=True),
            CsvExtractor("Left" if self.left_is_overtaker_side else "Right", "distance_overtaker",
                         lambda v: float(v) * 1e-2,
                         reject_raw=lambda v: v is None or int(v) == 999,
                         accept=lambda v: v >= 0,
                         default=None, required=True),
            CsvExtractor("Right" if self.left_is_overtaker_side else "Left", "distance_stationary",
                         lambda v: float(v) * 1e-2,
                         reject_raw=lambda v: v is None or int(v) == 999,
                         accept=lambda v: v >= 0,
                         default=None, required=True),
            CsvExtractor("Confirmed", ["confirmed", "raw_left_ix_confirmed"],
                         lambda v: [int(v) > 0, int(v) if int(v) > 0 else int(v)],
                         default=[None, None], required=True),
            CsvExtractor("Marked", "marked",
                         lambda v: str(v),
                         default=None, required=True),
            CsvExtractor("Invalid", "invalid",
                         lambda v: int(v) == 1,
                         default=None, required=True),
            CsvExtractor("InsidePrivacyArea", "in_privacy_zone",
                         lambda v: int(v) == 1,
                         default=None, required=True),
            CsvExtractor("Factor", "raw_factor",
                         lambda v: float(v),
                         default=None, required=True),
            CsvExtractor("Measurements", "raw_n_measurements",
                         lambda v: int(v),
                         default=None, required=True),
            CsvExtractor(["Tms" + str(i) for i in range(1, raw_n_max+1)], "raw_t0",
                         lambda v: float(v)*1e-3,
                         default=None, required=True, map_function=True),
            CsvExtractor(["Lus" + str(i) for i in range(1, raw_n_max + 1)], "raw_t_left",
                         lambda v: float(v)*1e-6,
                         default=None, required=True, map_function=True),
            CsvExtractor(["Rus" + str(i) for i in range(1, raw_n_max + 1)], "raw_t_right",
                         lambda v: float(v)*1e-6,
                         default=None, required=True, map_function=True),
        ]

        for e in extractors:
            e.set_header(header)

        return extractors


class CsvExtractor:

    def __init__(self, header_labels, labels, function, default=None, accept=lambda *args: True, map_function=False,
                 reject=lambda *args: False, required=False,
                 reject_raw=lambda *args: False, accept_raw=lambda *args: True):
        if not isinstance(header_labels, list):
            header_labels = [header_labels]

        self.labels = labels
        self.header_labels = header_labels
        self.indices = None
        self.function = function
        self.default = default
        self.accept = accept
        self.reject = reject
        self.accept_raw = accept_raw
        self.reject_raw = reject_raw
        self.required = required
        self.map_function = map_function
        self.valid = None

    def set_header(self, header):
        self.indices = [header.index(v) if v in header else None for v in self.header_labels]
        self.valid = all(ix is not None and ix >= 0 for ix in self.indices)
        if self.required and not self.valid:
            raise ValueError("header line does not contain required field " + str(self.header_labels))

    def apply(self, data, result_list):
        results = self.default
        if self.valid:
            if not all([0 <= i < len(data) for i in self.indices]):
                return results
            args = [data[ix] for ix in self.indices]
            if self.map_function:
                results = [self.default] * len(args)
                for i, arg in enumerate(args):
                    result = self.default
                    try:
                        if not self.reject_raw(arg) and self.accept_raw(arg):
                            result_tmp = self.function(arg)
                            if not self.reject(result_tmp) and self.accept(result_tmp):
                                result = result_tmp
                    except ValueError:
                        pass
                    results[i] = result
            else:
                results = self.default
                try:
                    if not self.reject_raw(*args) and self.accept_raw(*args):
                        results_tmp = self.function(*args)
                        if isinstance(results_tmp, list):
                            if not self.reject(*results_tmp) and self.accept(*results_tmp):
                                results = results_tmp
                        else:
                            if not self.reject(results_tmp) and self.accept(results_tmp):
                                results = results_tmp
                except ValueError:
                    pass

        if isinstance(self.labels, list):
            for label, result in zip(self.labels, results):
                result_list[label] = result
        else:
            result_list[self.labels] = results
