# Copyright (C) 2020-2021 OpenBikeSensor Contributors
# Contact: https://openbikesensor.org
#
# This file is part of the OpenBikeSensor Scripts Collection.
#
# The OpenBikeSensor Scripts Collection is free software: you can redistribute it and/or
# modify it under the terms of the GNU Lesser General Public License as
# published by the Free Software Foundation, either version 3 of the License,
# or (at your option) any later version.
#
# The OpenBikeSensor Scripts Collection is distributed in the hope that it will be
# useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser
# General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public License
# along with the OpenBikeSensor Scripts Collection.  If not, see
# <http://www.gnu.org/licenses/>.

import numpy as np
import logging

from .TileSource import TileSource
from .WayContainer import WayContainerAABBTree as WayContainer
from .Way import Way

log = logging.getLogger(__name__)


class DataSource:
    def __init__(self, cache_dir="cache", tile_zoom=14):
        self.nodes = {}
        self.ways = {}
        self.way_container = WayContainer()

        self.loaded_tiles = []
        self.tile_source = TileSource()
        self.tile_zoom = tile_zoom

    def ensure_coverage(self, lat, lon, extend=0.0):
        tiles = self.tile_source.get_required_tiles(lat, lon, self.tile_zoom, extend=extend)
        for tile in tiles:
            self.add_tile(tile)

    def get_way_by_id(self, way_id):
        if way_id and way_id in self.ways:
            return self.ways[way_id]
        else:
            return None

    def get_local_map(self):
        return self.local_map

    def add_tile(self, tile):
        # skip if already in tile list
        if tile in self.loaded_tiles:
            return

        # request tile, will be returned as a node-way-relation-split
        nodes, ways, relations = self.tile_source.get_tile(tile[0], tile[1], tile[2])

        # add nodes
        self.nodes.update(nodes)

        # add way objects, and store
        for way_id, way in ways.items():
            if way_id not in self.ways:
                w = Way(way_id, way, nodes)
                self.ways[way_id] = w
                self.way_container.insert(w)

        # update tile list
        self.loaded_tiles.append(tile)

    def get_map_center(self):
        lat = np.mean([node["lat"] for node in self.nodes.values()])
        lon = np.mean([node["lon"] for node in self.nodes.values()])
        return lat, lon

    def find_approximate_near_ways(self, lat_lon, d_max):
        return self.way_container.find_near_candidates(lat_lon, d_max=d_max)
