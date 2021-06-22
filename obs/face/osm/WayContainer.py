import numpy as np
import math

from aabbtree import AABB
from aabbtree import AABBTree

from obs.face.mapping import EquirectangularFast as LocalMap


class WayContainerAABBTree:
    def __init__(self, d_max=0):
        self.d_max = d_max
        self.data = AABBTree()

    def __del__(self):
        pass

    def insert(self, element):
        a, b = element.get_axis_aligned_bounding_box()
        aabb = AABB([(a[0], b[0]), (a[1], b[1])])
        self.data.add(aabb, element)

    def find_near_candidates(self, lat_lon, d_max):
        if not math.isfinite(lat_lon[0]) or not math.isfinite(lat_lon[1]):
            return []

        # transfer bounding box of +/- d_max (in meter) to a +/- d_lon and d_lat
        # (approximate, but very good for d_max << circumference earth)
        d_lat, d_lon = LocalMap.get_scale_at(lat_lon[0], lat_lon[1])
        d_lat *= d_max
        d_lon *= d_max

        # define an axis-aligned bounding box (in lat/lon) around the queried point lat_lon
        bb = AABB([(lat_lon[0] - d_lat, lat_lon[0] + d_lat), (lat_lon[1] - d_lon, lat_lon[1] + d_lon)])

        # and query all overlapping bounding boxes of ways
        candidates = self.data.overlap_values(bb)

        return candidates

    @staticmethod
    def axis_aligned_bounding_boxes_overlap(a1, b1, a2, b2):
        return np.all(a1 < b2) and np.all(a2 < b1)
