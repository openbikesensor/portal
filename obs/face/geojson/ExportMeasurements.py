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
import logging
import math

log = logging.getLogger(__name__)

class ExportMeasurements:
    def __init__(self, filename, do_filter=True):
        self.filename = filename
        self.features = None
        self.n_samples = 0
        self.n_valid = 0
        self.n_valid_latlon = 0
        self.n_valid_dist = 0
        self.n_confirmed = 0
        self.only_confirmed_measurements = do_filter
        self.only_valid_distances = do_filter
        self.show_GPS_position = False

    def add_measurements(self, data):
        self.features = []

        for m in data:
            self.n_samples += 1
            self.n_valid_latlon += not (m["latitude"] is None or m["longitude"] is None)
            self.n_valid_dist += m["distance_overtaker"] is not None
            self.n_confirmed += not (m["confirmed"] is not True)

            if m["latitude"] is None or m["longitude"] is None \
                    or self.only_valid_distances and m["distance_overtaker"] is None \
                    or self.only_confirmed_measurements and (m["confirmed"] is not True):
                continue
            self.n_valid += 1

            course = m["course"]
            if course is not None:
                course = 90.0 - math.degrees(course)
                course = course % 360.0

            if self.show_GPS_position:
                p_lon, p_lat = m["longitude_GPS"], m["latitude_GPS"]
            else:
                p_lon, p_lat = m["longitude"], m["latitude"]

            feature = {"type": "Feature",
                       "properties": {"time": str(m["time"]),
                                      "distance_overtaker": m["distance_overtaker"],
                                      "distance_stationary": m["distance_stationary"],
                                      "confirmed": m["confirmed"],
                                      "course": course,
                                      "speed": m["speed"],
                                      "user_id": m.get("user_id"),
                                      "measurement_id": m.get("measurement_id"),
                                      "egomotion_is_derived": m["egomotion_is_derived"],
                                      "latitude_GPS": m["latitude_GPS"] if "latitude_GPS" in m else None,
                                      "longitude_GPS": m["longitude_GPS"] if "longitude_GPS" in m else None,
                                      "latitude_projected":
                                          m["latitude_projected"] if "latitude_projected" in m else None,
                                      "longitude_projected":
                                          m["longitude_projected"] if "longitude_projected" in m else None,
                                      "has_OSM_annotations": m["has_OSM_annotations"],
                                      "OSM_way_id": m["OSM_way_id"] if "OSM_way_id" in m else None,
                                      "OSM_way_orientation": m[
                                          "OSM_way_orientation"] if "OSM_way_orientation" in m else None,
                                      "OSM_zone": m["OSM_zone"] if "OSM_zone" in m else None,
                                      "OSM_maxspeed": m["OSM_maxspeed"] if "OSM_maxspeed" in m else None,
                                      "OSM_name": m["OSM_name"] if "OSM_name" in m else None,
                                      "OSM_oneway": m["OSM_oneway"] if "OSM_oneway" in m else None,
                                      "OSM_lanes": m["OSM_lanes"] if "OSM_lanes" in m else None,
                                      "OSM_highway": m["OSM_highway"] if "OSM_highway" in m else None
                                      },
                       "geometry": {"type": "Point", "coordinates": [p_lon, p_lat]}
                       }

            self.features.append(feature)

    def finalize(self):
        log.info("%s samples, %s valid (%s valid lat/lon, %s valid distance, %s confirmed)",
                  self.n_samples, self.n_valid, self.n_valid_latlon, self.n_valid_dist, self.n_confirmed)

        data = {"type": "FeatureCollection",
                "features": self.features}

        os.makedirs(os.path.dirname(self.filename), exist_ok=True)

        log.info("writing GeoJSON file %s", self.filename)
        with open(self.filename, 'w') as f:
            json.dump(data, f)
