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

import logging
import math
import numpy as np
from joblib import Memory

from .LocalMap import AzimuthalEquidistant as LocalMap
from .RoadContainerAABBtree import RoadContainerAABBtree as RoadContainer
from .Way import Way

log = logging.getLogger(__name__)

class Roads:
    def __init__(self, osm, d_max=10.0, d_phi_max=40.0, cache_dir='cache'):
        self.d_max = d_max
        self.d_phi_max = math.radians(d_phi_max)

        self.memory = Memory(cache_dir, verbose=0, compress=True)

        self.create_roads_cached = self.memory.cache(self.create_roads, ignore=['self', 'osm'])

        log.info("creating road data structure")
        lat_0, lon_0 = osm.get_map_center()
        self.local_map = LocalMap(lat_0, lon_0)
        self.roads = self.create_roads_cached(osm, osm.data_id)
        log.info("finished road data structure")

    def __del__(self):
        pass

    def get_closest_way_oriented(self, sample):
        # we will at least need a valid position
        if sample["latitude"] is None or sample["longitude"] is None or sample["course"] is None:
            return None, None, [None, None]

        c_sample = sample["course"]
        x = self.local_map.transfer_to(sample["latitude"], sample["longitude"])
        candidate_list, dist_x_list, x_projected_list, dist_dir_list, way_orientation_list = self.roads.find_near(x, c_sample)

        d_best = self.d_max
        i_best = None
        for i, l in enumerate(candidate_list):
            d_x = dist_x_list[i]
            d_dir = dist_dir_list[i]
            if d_x < d_best and d_dir <= self.d_phi_max:
                i_best = i
                d_best = d_x

        way_id = None if i_best is None else candidate_list[i_best].aux
        way_orientation = None if i_best is None else way_orientation_list[i_best]
        lat_lon_projected = [None, None] if i_best is None else self.local_map.transfer_from(x_projected_list[i_best])

        return way_id, way_orientation, lat_lon_projected

    def get_n_closest_ways_oriented(self, sample, n):
        # we will at least need a valid position and moving direction
        if sample["latitude"] is None or sample["longitude"] is None or sample["course"] is None:
            # return None, None, None, None, None
            return [], [], [], [], []

        # find near candidates
        c_sample = sample["course"]
        x = self.local_map.transfer_to(sample["latitude"], sample["longitude"])
        way_list, dist_x_list, x_projected_list, dist_phi_list, way_orientation_list = self.roads.find_near(x, c_sample)

        # determine distances
        m = len(way_list)
        n_valid = 0
        d = [math.inf] * m
        for i in range(m):
            d_x = dist_x_list[i]
            d_dir = dist_phi_list[i]
            if d_x <= self.d_max and d_dir <= self.d_phi_max:
                d[i] = d_x
                n_valid += 1

        # determine n closest candidates
        i_sorted = np.argsort(d)
        m = min(n, n_valid)
        i_sorted = i_sorted[:m]

        # gather information on n closest candidates, starting with the best
        lat_projected = [0] * m
        lon_projected = [0] * m
        way_id = [0] * m
        way_orientation = [0] * m
        distances = [0] * m
        for j, i in enumerate(i_sorted):
            way_id[j] = way_list[i].aux
            way_orientation[j] = way_orientation_list[i]
            lat_projected[j], lon_projected[j] = self.local_map.transfer_from(x_projected_list[i])
            distances[j] = d[i]

        return way_id, way_orientation, lat_projected, lon_projected, distances

    def create_roads(self, osm, osm_data_id):
        # ignore1 and ignore2 are introduced to force memory to check these arguments
        roads = RoadContainer(self.d_max)

        # add each way
        for id_way, way in osm.ways.items():
            directional = self.get_way_directionality(way)

            points = []

            # go through all nodes of the way
            for node_id in way["nodes"]:
                node = osm.nodes[node_id]
                lat, lon = node["lat"], node["lon"]
                # transfer node to local coordinates
                p = self.local_map.transfer_to(lat, lon)
                points.append(p)

            w = Way(points, id_way, directional)
            roads.insert(w)

        return roads

    @staticmethod
    def get_way_directionality(way):
        if "tags" in way and "oneway" in way["tags"]:
            v = way["tags"]["oneway"]
            if v in ["yes", "true", "1"]:
                v = +1
            elif v in ["no", "false", "0"]:
                v = 0
            elif v in ["-1", "reverse"]:
                v = -1
        else:
            v = 0
        return v
