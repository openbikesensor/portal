import numpy as np
import math


class Way:
    def __init__(self, way_id, way, nodes, local_map):
        self.way_id = way_id

        if "tags" in way:
            self.tags = way["tags"]
        else:
            self.tags = {}

        # determine points
        self.points_xy = []
        self.points_latlon = []

        # go through all nodes of the way
        for node_id in way["nodes"]:
            node = nodes[node_id]
            lat, lon = node["lat"], node["lon"]
            # transfer node to local coordinates
            self.points_latlon.append((lat, lon))
            p = local_map.transfer_to(lat, lon)
            self.points_xy.append(p)

        x = [p[0] for p in self.points_xy]
        y = [p[1] for p in self.points_xy]

        # bounding box
        self.a = [min(x), min(y)]
        self.b = [max(x), max(y)]

        # direction
        dx = np.diff(x)
        dy = np.diff(y)

        # determine if way is directed, and which is the "forward" direction
        directional = self.get_way_directionality(way)
        direction = np.arctan2(dy, dx)
        if directional == 1:
            self.is_directional = True
            self.direction = direction
        elif directional == -1:
            self.is_directional = True
            self.direction = (direction + math.pi) % (2*math.pi)
        else:
            self.is_directional = False
            self.direction = direction

    def get_axis_aligned_bounding_box(self):
        return self.a, self.b

    def axis_aligned_bounding_boxes_overlap(self, a, b):
        return np.all(self.a < b) and np.all(a < self.b)

    def distance_of_point(self, xy, direction):
        # determine closest point on way
        p0 = None
        dist_x_best = math.inf
        i_best = None
        x_projected_best = None
        for i, p in enumerate(self.points_xy):
            if p0 is not None:
                d = p - p0
                dist, x_projected = self.point_line_distance(p0, d, xy)
                if dist < dist_x_best:
                    dist_x_best = dist
                    x_projected_best = x_projected
                    i_best = i
            p0 = p

        # also check deviation from way direction
        d = self.points_xy[i_best] - self.points_xy[i_best - 1]
        direction_ = math.atan2(d[1], d[0])

        d0 = self.distance_periodic(direction, direction_)
        if self.is_directional:
            dist_direction_best = d0
            way_orientation = +1
        else:
            d180 = self.distance_periodic(direction + math.pi, direction_)
            if d0 <= d180:
                way_orientation = +1
                dist_direction_best = d0
            else:
                way_orientation = -1
                dist_direction_best = d180

        return dist_x_best, x_projected_best, dist_direction_best, way_orientation

    @staticmethod
    def point_line_distance(p0, d, x):
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
