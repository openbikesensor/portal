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

import json
import os
import numpy as np
import logging

from obs.face.mapping import AzimuthalEquidistant as LocalMap

log = logging.getLogger(__name__)


class ExportRoadAnnotation:
    def __init__(self, filename, map_source, right_hand_traffic=True):
        self.filename = filename
        self.map_source = map_source
        self.features = None
        self.n_samples = 0
        self.n_valid = 0
        self.n_grouped = 0
        self.way_statistics = {}
        self.only_confirmed_measurements = True
        self.right_hand_traffic = right_hand_traffic

    def add_measurements(self, measurements):
        for sample in measurements:
            self.n_samples += 1
            # filter measurements
            if sample["latitude"] is None or sample["longitude"] is None or sample["distance_overtaker"] is None \
                    or self.only_confirmed_measurements and (sample["confirmed"] is not True) \
                    or not sample["has_OSM_annotations"]:
                continue

            self.n_valid += 1

            way_id = sample["OSM_way_id"]
            value = sample["distance_overtaker"]
            way_orientation = sample["OSM_way_orientation"]

            self.map_source.ensure_coverage([sample["latitude"]], [sample["longitude"]])

            if way_id in self.way_statistics:
                # way statistic object already created
                self.way_statistics[way_id].add_sample(value, way_orientation)
                self.n_grouped += 1
            else:
                way = self.map_source.get_way_by_id(way_id)
                if way:
                    # statistic object not created, but OSM way exists
                    self.way_statistics[way_id] = WayStatistics(way_id, way).add_sample(value, way_orientation)
                    self.n_grouped += 1
                else:
                    logging.warning("way not found in map")

    def finalize(self):
        log.info("%s samples, %s valid", self.n_samples, self.n_valid)
        features = []
        for way_stats in self.way_statistics.values():
            way_stats.finalize()
            if not any(way_stats.valid):
                continue

            for i in range(1 if way_stats.oneway else 2):
                direction = 0 if way_stats.oneway else +1 if i == 0 else -1

                way_osm = self.map_source.get_way_by_id(way_stats.way_id)
                if way_osm:
                    lateral_offset = 2.0 * direction * (-1 if self.right_hand_traffic else +1)
                    reverse = i == 1
                    coordinates = way_osm.get_way_coordinates(reverse=reverse, lateral_offset=lateral_offset)
                    # exchange lat and lon
                    coordinates = [(p[1], p[0]) for p in coordinates]
                else:
                    coordinates = []

                feature = {"type": "Feature",
                           "properties": {"distance_overtaker_mean": way_stats.d_mean[i],
                                          "distance_overtaker_median": way_stats.d_median[i],
                                          "distance_overtaker_minimum": way_stats.d_minimum[i],
                                          "distance_overtaker_n": way_stats.n[i],
                                          "distance_overtaker_n_below_limit": way_stats.n_lt_limit[i],
                                          "distance_overtaker_n_above_limit": way_stats.n_geq_limit[i],
                                          "distance_overtaker_limit": way_stats.d_limit,
                                          "distance_overtaker_measurements": way_stats.samples[i],
                                          "zone": way_stats.zone,
                                          "direction": direction,
                                          "name": way_stats.name,
                                          "way_id": way_stats.way_id,
                                          "valid": way_stats.valid[i],
                                          },
                           "geometry": {"type": "LineString", "coordinates": coordinates}}

                features.append(feature)

        data = {"type": "FeatureCollection",
                "features": features}

        os.makedirs(os.path.dirname(self.filename), exist_ok=True)

        with open(self.filename, 'w') as f:
            json.dump(data, f)


class WayStatistics:
    def __init__(self, way_id, way):
        self.samples = [[], []]
        self.n = [0, 0]
        self.n_lt_limit = [0, 0]
        self.n_geq_limit = [0, 0]

        self.way_id = way_id
        self.valid = [False, False]
        self.d_mean = [0, 0]
        self.d_median = [0, 0]
        self.d_minimum = [0, 0]

        self.zone = "unknown"
        self.oneway = False
        self.name = "unknown"

        tags = way.tags
        if "zone:traffic" in tags:
            zone = tags["zone:traffic"]
            if zone == "DE:urban":
                zone = "urban"
            elif zone == "DE:rural":
                zone = "rural"
            elif zone == "DE:motorway":
                zone = "motorway"
            self.zone = zone

        if "oneway" in tags:
            self.oneway = tags["oneway"] == "yes"

        if "name" in tags:
            self.name = tags["name"]

        self.d_limit = 1.5 if self.zone == "urban" else 2.0 if self.zone == "rural" else 1.5

    def add_sample(self, sample, orientation):
        if np.isfinite(sample):
            i = 1 if orientation == -1 else 0
            self.samples[i].append(sample)
        return self

    def finalize(self):
        for i in range(2):
            samples = np.array(self.samples[i])
            if len(samples) > 0:
                self.n[i] = len(samples)
                self.d_mean[i] = np.mean(samples)
                self.d_median[i] = np.median(samples)
                self.d_minimum[i] = np.min(samples)
                if self.d_limit is not None:
                    self.n_lt_limit[i] = int((samples < self.d_limit).sum())
                    self.n_geq_limit[i] = int((samples >= self.d_limit).sum())
                self.valid[i] = True
