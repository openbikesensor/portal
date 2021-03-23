# Copyright (C) 2020-2021 OpenBikeSensor Contributors
# Contact: https://openbikesensor.org
#
# This file is part of the OpenBikeSensor Scripts.
#
# The OpenBikeSensor Scripts are free software: you can redistribute it and/or
# modify it under the terms of the GNU Lesser General Public License as
# published by the Free Software Foundation, either version 3 of the License,
# or (at your option) any later version.
#
# The OpenBikeSensor Scripts are distributed in the hope that it will be
# useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser
# General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public License
# along with the OpenBikeSensor Scripts.  If not, see
# <http://www.gnu.org/licenses/>.

import numpy as np
import math

from aabbtree import AABB
from aabbtree import AABBTree


class RoadContainerAABBtree:
    def __init__(self, d_max=0):
        self.d_max = d_max
        self.data = AABBTree()

    def __del__(self):
        pass

    def insert(self, element):
        a, b = element.get_axis_aligned_bounding_box()

        e = AABB([(a[0], b[0]), (a[1], b[1])])
        self.data.add(e, element)

    def find_near(self, x, direction):
        # find candidates, exclude only those which are safe to exclude
        candidates = self.find_near_candidates(x, self.d_max)
        # then enumerate all candidates an do precise search
        dist_x_list = []
        dist_dir_list = []
        x_projected_list = []
        way_direction_list = []
        for r in candidates:
            dist_x, x_projected, dist_dir, way_direction = r.distance_of_point(x, direction)
            dist_x_list.append(dist_x)
            dist_dir_list.append(dist_dir)
            x_projected_list.append(x_projected)
            way_direction_list.append(way_direction)
        return candidates, dist_x_list, x_projected_list, dist_dir_list, way_direction_list

    def find_near_candidates(self, x, d_max):
        if not math.isfinite(x[0]) or not math.isfinite(x[1]):
            return []

        # the point x and a square environment
        bb = AABB([(x[0] - d_max, x[0] + d_max), (x[1] - d_max, x[1] + d_max)])

        candidates = self.data.overlap_values(bb)

        return candidates

    def axis_aligned_bounding_boxes_overlap(self, a1, b1, a2, b2):
        return np.all(a1 < b2) and np.all(a2 < b1)
