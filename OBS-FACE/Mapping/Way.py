import numpy as np
import math


class Way:
    def __init__(self, p_list, aux, directional=0):
        self.p_list = p_list

        x = [p[0] for p in p_list]
        y = [p[1] for p in p_list]

        self.a = [min(x), min(y)]
        self.b = [max(x), max(y)]
        self.aux = aux

        dx = np.diff(x)
        dy = np.diff(y)

        direction_ = np.arctan2(dy, dx)
        if directional == 1:
            self.is_directional = True
            self.direction = direction_
        elif directional == -1:
            self.is_directional = True
            self.direction = direction_ + math.pi
        else:
            self.is_directional = False
            self.direction = direction_

    def get_axis_aligned_bounding_box(self):
        return self.a, self.b

    def axis_aligned_bounding_boxes_overlap(self, a, b):
        return np.all(self.a < b) and np.all(a < self.b)

    def distance_of_point(self, x, direction):
        p0 = None
        dist_x_best = math.inf
        i_best = None
        x_projected_best = None
        for i, p in enumerate(self.p_list):
            if p0 is not None:
                d = p - p0
                dist, x_projected = self.distance_of_point2(p0, d, x)
                if dist < dist_x_best:
                    dist_x_best = dist
                    x_projected_best = x_projected
                    i_best = i
            p0 = p

        d = self.p_list[i_best] - self.p_list[i_best - 1]
        direction_ = math.atan2(d[1], d[0])

        d0 = self.distance_periodic(direction, direction_)
        if self.is_directional:
            dist_direction_best = d0
            way_direction = +1
        else:
            d180 = self.distance_periodic(direction + math.pi, direction_)
            if d0 <= d180:
                way_direction = +1
                dist_direction_best = d0
            else:
                way_direction = -1
                dist_direction_best = d180

        return dist_x_best, x_projected_best, dist_direction_best, way_direction

    def distance_of_point2(self, p0, d, x):
        c = x - p0

        dd = np.inner(d, d)
        if dd > 0:
            # line has non-zero length
            # optimal lambda
            lambda_star = np.inner(d, c) / dd
            # project (clip) to [0,1]
            # lambda_star = np.clip(lambda_star, a_min=0.0, a_max=1.0)
            lambda_star = max(0.0, min(1.0, lambda_star))
            # compute  nearest point on line
            x_star = p0 + lambda_star * d
        else:
            # line has zero length
            x_star = p0

        # compute actual distance to line
        d_star = np.linalg.norm(x_star - x)

        return d_star, x_star

    @staticmethod
    def distance_periodic(a, b, p=2 * math.pi):
        p2 = 0.5*p
        d = a - b
        return abs((d + p2) % p - p2)

