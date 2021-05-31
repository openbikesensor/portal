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
# from joblib import Memory

from .LocalMap import AzimuthalEquidistant as LocalMap


log = logging.getLogger(__name__)

class Roads:
    def __init__(self, maps_source, d_max=10.0, d_phi_max=40.0, cache_dir='cache'):
        self.d_max = d_max
        self.d_phi_max = math.radians(d_phi_max)

        # self.memory = Memory(cache_dir, verbose=0, compress=True)

        self.map_source = maps_source

    def __del__(self):
        pass

    def get_n_closest_ways_oriented(self, sample, n):
        # we will at least need a valid position and moving direction
        if sample["latitude"] is None or sample["longitude"] is None or sample["course"] is None:
            return [], [], [], [], []

        # find near candidates
        c_sample = sample["course"]
        x = self.map_source.local_map.transfer_to(sample["latitude"], sample["longitude"])
        way_list, dist_x_list, x_projected_list, dist_phi_list, way_orientation_list = self.find_near(x, c_sample)

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
            way_id[j] = way_list[i].way_id
            way_orientation[j] = way_orientation_list[i]
            lat_projected[j], lon_projected[j] = self.map_source.local_map.transfer_from(x_projected_list[i])
            distances[j] = d[i]

        return way_id, way_orientation, lat_projected, lon_projected, distances

    def find_near(self, x, course):
        # find candidates, exclude only those which are safe to exclude
        ways = self.map_source.find_approximate_near_ways(x, self.d_max)

        # then enumerate all candidates an do precise search
        dist_x = []
        dist_dir = []
        x_projected = []
        orientation = []
        for way in ways:
            dist_x_way, x_projected_way, dist_dir_way, orientation_way = way.distance_of_point(x, course)
            dist_x.append(dist_x_way)
            dist_dir.append(dist_dir_way)
            x_projected.append(x_projected_way)
            orientation.append(orientation_way)
        return ways, dist_x, x_projected, dist_dir, orientation

