import numpy as np
import math
from obs.face.mapping import EquirectangularFast as LocalMap


def get_way_directionality(tags):
    v = tags.get("oneway")
    if v in ["yes", "true", "1"]:
        return 1
    if v in ["-1", "reverse"]:
        return -1
    return 0


class Way:
    def __init__(self, way_id, tags, coordinates):
        self.way_id = way_id
        self.tags = tags or {}

        lat = coordinates[:, 0]
        lon = coordinates[:, 1]
        self.coordinates = coordinates

        # bounding box
        self.a = (min(lat), min(lon))
        self.b = (max(lat), max(lon))

        # define the local map around the center of the bounding box
        lat_0 = (self.a[0] + self.b[0]) * 0.5
        lon_0 = (self.a[1] + self.b[1]) * 0.5
        self.local_map = LocalMap(lat_0, lon_0)

        # transfer way points to local coordinate system
        x, y = self.local_map.transfer_to(lat, lon)
        self.points_xy = np.stack((x, y), axis=1)

        # direction
        dx = np.diff(x)
        dy = np.diff(y)
        self.direction = np.arctan2(dy, dx)

        # determine if way is directed, and which is the "forward" direction
        directional = get_way_directionality(self.tags)
        self.is_directional = directional != 0

        # reverse the direction of reverse oneway streets
        if directional == -1:
            self.direction = (self.direction + math.pi) % (2 * math.pi)

    def get_axis_aligned_bounding_box(self):
        return self.a, self.b

    def distance_of_point(self, lat_lon, direction_sample):
        # transfer lat_lon to local coordinate system
        xy = np.array(self.local_map.transfer_to(lat_lon[0], lat_lon[1]))

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

        # transfer projected point to lat_lon
        lat_lon_projected_best = self.local_map.transfer_from(
            x_projected_best[0], x_projected_best[1]
        )

        # also check deviation from way direction
        direction_best = self.direction[i_best - 1]
        d0 = self.distance_periodic(direction_sample, direction_best)
        if self.is_directional:
            dist_direction_best = d0
            way_orientation = +1
        else:
            d180 = self.distance_periodic(direction_sample + math.pi, direction_best)
            if d0 <= d180:
                way_orientation = +1
                dist_direction_best = d0
            else:
                way_orientation = -1
                dist_direction_best = d180

        return dist_x_best, lat_lon_projected_best, dist_direction_best, way_orientation

    def get_way_coordinates(self, reverse=False, lateral_offset=0):
        if lateral_offset == 0:
            coordinates = (
                list(reversed(self.coordinates)) if reverse else self.coordinates
            )
        else:
            c = self.points_xy

            # compute normals, pointing to the left
            n = []
            for i in range(len(c) - 1):
                n_i = c[i + 1] - c[i]
                n_i = n_i / np.linalg.norm(n_i)
                n_i = np.array([-n_i[1], +n_i[0]])
                n.append(n_i)

            # move points
            coordinates = []
            for i in range(len(c)):
                # create an average normal for each node
                n_prev = n[max(0, i - 1)]
                n_next = n[min(len(n) - 1, i)]
                n_i = 0.5 * (n_prev + n_next)
                # make sure it is normalized
                n_i = n_i / np.linalg.norm(n_i)
                # then move the point
                c_i = c[i] + n_i * lateral_offset
                c_i = self.local_map.transfer_from(c_i[0], c_i[1])
                coordinates.append([c_i[0], c_i[1]])

        return coordinates

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
        p2 = 0.5 * p
        d = a - b
        return abs((d + p2) % p - p2)
