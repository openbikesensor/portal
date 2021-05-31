import numpy as np
import math

from aabbtree import AABB
from aabbtree import AABBTree


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

    def find_near_candidates(self, x, d_max):
        if not math.isfinite(x[0]) or not math.isfinite(x[1]):
            return []

        # the point x and a square environment
        bb = AABB([(x[0] - d_max, x[0] + d_max), (x[1] - d_max, x[1] + d_max)])

        candidates = self.data.overlap_values(bb)

        return candidates

    @staticmethod
    def axis_aligned_bounding_boxes_overlap(a1, b1, a2, b2):
        return np.all(a1 < b2) and np.all(a2 < b1)
