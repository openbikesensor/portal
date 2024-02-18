import numpy as np
import math

from aabbtree import AABB
from aabbtree import AABBTree

from obs.face.mapping import EquirectangularFast as LocalMap


class WayContainerAABBTree:
    def __init__(self):
        self.data = AABBTree()

    def insert(self, element):
        a, b = element.get_axis_aligned_bounding_box()
        aabb = AABB([(a[0], b[0]), (a[1], b[1])])
        self.data.add(aabb, element)

    def find_near_candidates(self, lat_lon, d_max):
        if not math.isfinite(lat_lon[0]) or not math.isfinite(lat_lon[1]):
            return []

        # transfer bounding box of +/- d_max (in meter) to a +/- d_lon and d_lat
        # (approximate, but very good for d_max << circumference earth)
        s_lat, s_lon = LocalMap.get_scale_at(lat_lon[0], lat_lon[1])

        # define an axis-aligned bounding box (in lat/lon) around the queried point lat_lon
        bb = AABB(
            [
                (lat_lon[0] - s_lat * d_max, lat_lon[0] + s_lat * d_max),
                (lat_lon[1] - s_lon * d_max, lat_lon[1] + s_lon * d_max),
            ]
        )

        # and query all overlapping bounding boxes of ways
        candidates = self.data.overlap_values(bb)

        return candidates
