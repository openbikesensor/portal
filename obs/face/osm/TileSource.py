import requests
import numpy as np
import logging
import math
import os
import pickle
import time


class TileSource:
    def __init__(self, cache_dir='./cache', use_cache=True):
        self.overpass_url = "http://overpass-api.de/api/interpreter"

        self.query_template = dict()

        # self.memory = Memory(cache_dir, verbose=0, compress=True)

        # self.request_tile_cached = self.memory.cache(self.request_tile, ignore=['self'])
        self.cache_dir = cache_dir
        self.use_cache = use_cache

        # [out:json]
        # [{{bbox}}];
        # (way["highway"~"primary|secondary"];>;);
        # out body;

        self.query_template["default"] = """
        [out:json];        
        (way({bbox[0]:},{bbox[1]:},{bbox[2]:},{bbox[3]:})["highway"~"trunk|primary|secondary|tertiary|unclassified|residential|trunk_link|primary_link|secondary_link|tertiary_link|living_street|service|track|road"];>;);
        out body;"""

    def get_tile(self, zoom, x_tile, y_tile, filter_id="default"):
        logging.debug("tile requested: zoom=%d, x=%d, y=%d, filter_id=%s", zoom, x_tile, y_tile, filter_id)

        # try to read from cache
        filename_cache = os.path.join(self.cache_dir, 'TileSource', filter_id, str(zoom), str(x_tile), str(y_tile), 'tile.pickle')
        request_tile = True
        if self.use_cache and os.path.isfile(filename_cache):
            logging.debug("loading tile cached in %s", filename_cache)
            request_tile = False
            try:
                with open(filename_cache, 'rb') as infile:
                    # data = jsons.loads(infile.read())
                    data = pickle.load(infile)
                nodes, ways, relations = data["nodes"], data["ways"], data["relations"]
            except IOError as e:
                logging.debug("loading tile %s failed", filename_cache)
                request_tile = True

        # try to retrieve from server
        if request_tile:
            # request from OSM server
            response = self.request_tile(zoom, x_tile, y_tile, filter_id)

            # convert to nodes and ways
            nodes, ways, relations = self.convert_to_dict(response)

            # write to cache if
            if self.use_cache:
                logging.debug("writing tile to %s", filename_cache)
                data = {"nodes": nodes, "ways": ways, "relations": relations}
                os.makedirs(os.path.dirname(filename_cache), exist_ok=True)
                with open(filename_cache, 'wb') as outfile:
                    # outfile.write(data)
                    pickle.dump(data, outfile)

        return nodes, ways, relations

    def request_tile(self, zoom, x_tile, y_tile, filter_id="default"):
        # construct the query
        parameters = {"bbox": self.get_tile_bounding_box(zoom, x_tile, y_tile)}
        query = self.query_template[filter_id].format(**parameters)

        success = False
        for try_count in range(3):
            # send query and receive answer
            response = requests.get(self.overpass_url,
                                    params={'data': query})

            if response.status_code == 200:
                success = True
                break

            logging.warning('could not retrieve tile, server returned %s (%d)', response.reason, response.status_code)
            time.sleep((try_count+1) * 3)

        if success:
            # decode to JSON
            response_json = response.json()
        else:
            response_json = None

        return response_json

    def get_tile_bounding_box(self, zoom, x_tile, y_tile):
        south, east = self.tile2latlon(zoom, x_tile + 1, y_tile + 1)
        north, west = self.tile2latlon(zoom, x_tile, y_tile)
        return south, west, north, east

    def get_required_tiles_bounding_box(self, lat, lon, zoom, tolerance_lat=0, tolerance_lon=0):
        lat_min = np.amin(lat) - tolerance_lat
        lat_max = np.amax(lat) + tolerance_lat
        lon_min = np.amin(lon) - tolerance_lon
        lon_max = np.amax(lon) + tolerance_lon

        x_min, y_min = self.latlon2tile(zoom, lat_max, lon_min)
        x_max, y_max = self.latlon2tile(zoom, lat_min, lon_max)

        tiles = [(zoom, x, y) for x in range(x_min, x_max + 1) for y in range(y_min, y_max + 1)]
        return tiles

    def get_required_tiles(self, lat, lon, zoom, tolerance_lat=0, tolerance_lon=0):
        tiles = set()

        for lat_, lon_ in zip(lat, lon):
            if lat_ and lon_ and -90 <= lat_ <= +90 and -180.0 <= lon_ <= +180:
                x, y = self.latlon2tile(zoom, lat_, lon_)
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

    @staticmethod
    def convert_to_dict(data):
        nodes = {}
        ways = {}
        relations = {}

        for e in data["elements"]:
            type_e = e["type"]
            id_e = e["id"]
            if type_e == "node":
                nodes[id_e] = e
            elif type_e == "way":
                ways[id_e] = e
            elif type_e == "relation":
                relations[id_e] = e

        return nodes, ways, relations
