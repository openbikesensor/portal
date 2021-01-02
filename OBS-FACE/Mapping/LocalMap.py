import math
import numpy as np


class LocalMapTangential:
    def __init__(self, lat_0, lon_0):
        # radius earth [m]
        self.r_earth = 40000e3/(2*math.pi)

        self.x0, self.n0_east, self.n0_north = self.latlon2xyz_tan(lat_0, lon_0)

    def transfer_to(self, lat, lon):
        # transfer to a new taqngential coordinate system
        # first coordinate points to east, second to north
        x = self.latlon2xyz(lat, lon)

        x = np.array(x)
        dx = x - self.x0
        x_north = np.inner(self.n0_north, dx)
        x_east = np.inner(self.n0_east, dx)

        return np.array([x_east, x_north])

    def transfer_from(self, x):
        x_east = x[0]
        x_north = x[1]
        xyz = self.x0 + x_east * self.n0_east + x_north * self.n0_north
        lat, lon = self.xyz2latlon(xyz)
        return lat, lon

    @staticmethod
    def get_local_compass_direction(x):
        # x[0] points east, x[1] points north
        # counter-clockwise, radiants, east = 0
        phi = math.atan2(x[1], x[0])
        # clock-wise, degrees, north = 0
        phi = 90.0 - math.degrees(phi)
        return phi

    @staticmethod
    def get_local_direction(x):
        # x[0] points east, x[1] points north
        # counter-clockwise, radiants, east = 0
        phi = math.atan2(x[1], x[0])
        return phi

    def latlon2xyz(self, lat, lon):
        r = self.r_earth

        # degree to radians
        theta = math.radians(lat)
        lambda_ = math.radians(lon)

        # sin and cos
        sin_theta = math.sin(theta)
        cos_theta = math.cos(theta)
        sin_lambda = math.sin(lambda_)
        cos_lambda = math.cos(lambda_)

        # return r * np.array([cos_theta * cos_lambda, cos_theta * sin_lambda, sin_theta])
        return r*cos_theta * cos_lambda, r * cos_theta * sin_lambda, r * sin_theta

    def xyz2latlon(self, xyz):
        r = self.r_earth
        lat = math.asin(xyz[2] / r)
        lon = math.atan2(xyz[1], xyz[0])

        # degree to radians
        lat = math.degrees(lat)
        lon = math.degrees(lon)

        return lat, lon

    @staticmethod
    def latlon_tangential(lat, lon):
        # degree to radians
        theta = math.radians(lat)
        lambda_ = math.radians(lon)

        # sin and cos
        sin_theta = math.sin(theta)
        cos_theta = math.cos(theta)
        sin_lambda = math.sin(lambda_)
        cos_lambda = math.cos(lambda_)

        # the following normalized vectors span the normal plane at x0
        # https://en.wikipedia.org/wiki/Local_tangent_plane_coordinates
        # north, east, down
        n0_north = np.array([-sin_theta * cos_lambda, -sin_theta * sin_lambda, cos_theta])
        n0_east = np.array([-sin_lambda, + cos_lambda, 0])

        return n0_east, n0_north

    def latlon2xyz_tan(self, lat, lon):
        # radius earth
        r = self.r_earth

        # degree to radians
        theta = math.radians(lat)
        lambda_ = math.radians(lon)

        # sin and cos
        sin_theta = math.sin(theta)
        cos_theta = math.cos(theta)
        sin_lambda = math.sin(lambda_)
        cos_lambda = math.cos(lambda_)

        xyz = r * np.array([cos_theta * cos_lambda, cos_theta * sin_lambda, sin_theta])

        n_north = np.array([-sin_theta * cos_lambda, -sin_theta * sin_lambda, cos_theta])
        n_east = np.array([-sin_lambda, + cos_lambda, 0])

        return xyz, n_east, n_north


class Gnomonic:
    def __init__(self, lat_0, lon_0):
        self.lat_0 = lat_0
        self.lon_0 = lon_0

    def transfer_to(self, lat, lon):
        lambda_ = math.radians(lon)
        phi = math.radians(lat)
        lambda_0 = math.radians(self.lon_0)
        phi_1 = math.radians(self.lat_0)

        # https://mathworld.wolfram.com/GnomonicProjection.html
        cos_c = math.sin(phi_1) * math.sin(phi) + math.cos(phi_1) * math.cos(phi) * math.cos(lambda_ - lambda_0)

        x = math.cos(phi) * math.sin(lambda_ - lambda_0) / cos_c
        y = (math.cos(phi_1) * math.sin(phi) - math.sin(phi_1) * math.cos(phi) * math.cos(lambda_ - lambda_0)) / cos_c
        return np.array([x, y])

    def transfer_from(self, xy):
        x = xy[0]
        y = xy[1]
        lambda_0 = math.radians(self.lon_0)
        phi_1 = math.radians(self.lat_0)

        # https: // mathworld.wolfram.com / GnomonicProjection.html
        rho = math.sqrt(x*x + y*y)
        c = math.atan(rho)
        cos_c = math.cos(c)
        sin_c = math.sin(c)

        phi = math.asin(cos_c * math.sin(phi_1) + y * sin_c * math.cos(phi_1)/rho )
        lambda_ = lambda_0  + math.atan(x * sin_c / (rho * math.cos(phi_1) * math.cos_c - y * math.sin(phi_1) * sin_c ))

        lat = math.degrees(phi)
        lon = math.degrees(lambda_)
        return lat, lon

    @staticmethod
    def get_local_compass_direction(x):
        # x[0] points east, x[1] points north
        # counter-clockwise, radiants, east = 0
        phi = math.atan2(x[1], x[0])
        # clock-wise, degrees, north = 0
        phi = 90.0 - math.degrees(phi)
        return phi

    @staticmethod
    def get_local_direction(x):
        # x[0] points east, x[1] points north
        # counter-clockwise, radiants, east = 0
        phi = math.atan2(x[1], x[0])
        return phi


class AzimuthalEquidistant:
    def __init__(self, lat_0, lon_0):
        # radius earth [m]
        self.r_earth = 40000e3 / (2 * math.pi)

        self.lat_0 = lat_0
        self.lon_0 = lon_0

    def transfer_to(self, lat, lon):
        lambda_ = math.radians(lon)
        phi = math.radians(lat)
        lambda_0 = math.radians(self.lon_0)
        phi_1 = math.radians(self.lat_0)

        # https://mathworld.wolfram.com/AzimuthalEquidistantProjection.html
        cos_c = math.sin(phi_1) * math.sin(phi) + math.cos(phi_1) * math.cos(phi) * math.cos(lambda_ - lambda_0)
        # fix rounding errors
        cos_c = np.clip(cos_c, -1.0, +1.0)
        c = math.acos(cos_c)

        # k_prime = c / math.sin(c)
        k_prime = 1 / np.sinc(c / math.pi)
        x = k_prime * math.cos(phi) * math.sin(lambda_ - lambda_0)
        y = k_prime * (math.cos(phi_1) * math.sin(phi) - math.sin(phi_1) * math.cos(phi) * math.cos(lambda_ - lambda_0))

        X = x * self.r_earth
        Y = y * self.r_earth
        return np.array([X, Y])

    def transfer_from(self, XY):
        x = XY[0] / self.r_earth
        y = XY[1] / self.r_earth
        lambda_0 = math.radians(self.lon_0)
        phi_1 = math.radians(self.lat_0)

        # https://mathworld.wolfram.com/AzimuthalEquidistantProjection.html
        c = math.sqrt(x*x + y*y)
        cos_c = math.cos(c)

        phi = math.asin(cos_c * math.sin(phi_1) + y * math.sin(c) * math.cos(phi_1) / c)
        if phi_1 == +math.pi/2:
            lambda_ = lambda_0 + math.atan(-x/y)
        elif phi_1 == -math.pi/2:
            lambda_ = lambda_0 + math.atan(x/y)
        else:
            lambda_ = lambda_0 + math.atan(x * math.sin(c) /
                                           (c * math.cos(phi_1) * cos_c - y * math.sin(phi_1) * math.sin(c) ))

        lat = math.degrees(phi)
        lon = math.degrees(lambda_)
        return lat, lon

    @staticmethod
    def get_local_compass_direction(x):
        # x[0] points east, x[1] points north
        # counter-clockwise, radiants, east = 0
        phi = math.atan2(x[1], x[0])
        # clock-wise, degrees, north = 0
        phi = 90.0 - math.degrees(phi)
        return phi

    @staticmethod
    def get_local_direction(x):
        # x[0] points east, x[1] points north
        # counter-clockwise, radiants, east = 0
        phi = math.atan2(x[1], x[0])
        return phi
