import math
from abc import ABC, abstractmethod

from obs.face.mapping.LocalMap import EquirectangularFast as LocalMap


class TileSource(ABC):
    @abstractmethod
    async def get_tile(self, zoom, x_tile, y_tile):
        pass

    def get_required_tiles(self, lat, lon, zoom, extend=0):
        tiles = set()

        # extract only valid coordinates
        lat_lon = [(lat_, lon_) for lat_, lon_ in zip(lat, lon) if lat_ and lon_]

        # if there are no valid coordinates, just return an empty set
        if len(lat_lon) == 0:
            return tiles

        # derive tolerance, measured in degree
        i = len(lat_lon) // 2
        s_lat, s_lon = LocalMap.get_scale_at(lat_lon[i][0], lat_lon[i][1])
        tol_lat = s_lat * extend
        tol_lon = s_lon * extend

        # go through each point in the lat-lon-list
        for lat_, lon_ in lat_lon:
            # consider the corners of a box, centered at the point (lat_, lon_) and size 2 tol_lat x 2 tol_lan
            for lat__ in (lat_ - tol_lat, lat_ + tol_lat):
                for lon__ in (lon_ - tol_lon, lon_ + tol_lon):
                    # make sure it's a valid coordinate
                    if -90 <= lat__ <= +90 and -180.0 <= lon__ <= +180:
                        # get tile position
                        x, y = self.latlon2tile(zoom, lat_, lon_)
                        # and add to set
                        tiles.add((zoom, x, y))

        return tiles

    @staticmethod
    def latlon2tile(zoom, lat_deg, lon_deg):
        lat_rad = math.radians(lat_deg)
        n = 2.0 ** zoom
        x_tile = int((lon_deg + 180.0) / 360.0 * n)
        y_tile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
        return x_tile, y_tile

    @staticmethod
    def tile2latlon(zoom, x_tile, y_tile):
        n = 2.0 ** zoom
        lon_deg = x_tile / n * 360.0 - 180.0
        lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * y_tile / n)))
        lat_deg = math.degrees(lat_rad)
        return lat_deg, lon_deg
