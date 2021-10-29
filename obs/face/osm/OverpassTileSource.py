import requests
import numpy as np
import logging
import math
import os
import pickle
import time

from obs.face.mapping.LocalMap import EquirectangularFast as LocalMap

from .TileSource import TileSource

log = logging.getLogger(__name__)

QUERY_TEMPLATE = (
    "[out:json];"
    "(way({bbox[0]:},{bbox[1]:},{bbox[2]:},{bbox[3]:})"
    '["highway"~"trunk|primary|secondary|tertiary|unclassified|residential|trunk_link|primary_link|secondary_link|tertiary_link|living_street|service|track|road"]'
    ";>;);"
    "out body;"
)


class OverpassTileSource(TileSource):
    def __init__(self, cache_dir="./cache"):
        super().__init__()

        self.overpass_url = "http://overpass-api.de/api/interpreter"
        self.cache_dir = cache_dir

    async def get_tile(self, zoom, x_tile, y_tile):
        log.debug(
            "tile requested: zoom=%d, x=%d, y=%d",
            zoom,
            x_tile,
            y_tile,
        )

        # try to read from cache
        filename_cache = os.path.join(
            self.cache_dir,
            "OverpassTileSource",
            str(zoom),
            str(x_tile),
            str(y_tile),
            "tile.pickle",
        )
        request_tile = True
        if self.cache_dir and os.path.isfile(filename_cache):
            log.debug("loading tile cached in %s", filename_cache)
            request_tile = False
            try:
                with open(filename_cache, "rb") as infile:
                    # data = jsons.loads(infile.read())
                    data = pickle.load(infile)
                nodes, ways = data["nodes"], data["ways"]
            except IOError:
                log.debug("loading tile %s failed", filename_cache, exc_info=True)
                request_tile = True

        # try to retrieve from server
        if request_tile:
            # request from OSM server
            response = self.request_tile(zoom, x_tile, y_tile)

            # convert to nodes and ways
            nodes, ways = self.convert_to_dict(response)

            # write to cache if
            if self.cache_dir:
                log.debug("writing tile to %s", filename_cache)
                data = {"nodes": nodes, "ways": ways}
                os.makedirs(os.path.dirname(filename_cache), exist_ok=True)
                with open(filename_cache, "wb") as outfile:
                    # outfile.write(data)
                    pickle.dump(data, outfile)

        # self.nodes.update(nodes)
        for way_id, way in ways.items():
            coordinates = np.array(
                [[nodes[i]["lat"], nodes[i]["lon"]] for i in way["nodes"]]
            )

            yield way_id, way.get("tags"), coordinates

    def request_tile(self, zoom, x_tile, y_tile):
        # construct the query
        query = QUERY_TEMPLATE.format(
            bbox=self.get_tile_bounding_box(zoom, x_tile, y_tile)
        )

        success = False
        for try_count in range(3):
            # send query and receive answer
            response = requests.get(self.overpass_url, params={"data": query})

            if response.status_code == 200:
                success = True
                break

            log.warning(
                "could not retrieve tile, server returned %s (%d)",
                response.reason,
                response.status_code,
            )
            time.sleep((try_count + 1) * 3)

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

    @staticmethod
    def convert_to_dict(data):
        nodes = {}
        ways = {}

        for e in data["elements"]:
            type_e = e["type"]
            id_e = e["id"]
            if type_e == "node":
                nodes[id_e] = e
            elif type_e == "way":
                ways[id_e] = e

        return nodes, ways
