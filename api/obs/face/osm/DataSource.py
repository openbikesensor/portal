# Copyright (C) 2020-2021 OpenBikeSensor Contributors
# Contact: https://openbikesensor.org
#
# This file is part of the OpenBikeSensor Portal Software.
#
# The OpenBikeSensor Portal Software is free software: you can redistribute it and/or
# modify it under the terms of the GNU Lesser General Public License as
# published by the Free Software Foundation, either version 3 of the License,
# or (at your option) any later version.
#
# The OpenBikeSensor Portal Software is distributed in the hope that it will be
# useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser
# General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public License
# along with the OpenBikeSensor Portal Software.  If not, see
# <http://www.gnu.org/licenses/>.

import numpy as np
import logging

from .WayContainer import WayContainerAABBTree as WayContainer
from .Way import Way

log = logging.getLogger(__name__)


class DataSource:
    def __init__(self, tile_source, tile_zoom=14):
        self.nodes = {}
        self.ways = {}
        self.way_container = WayContainer()

        self.loaded_tiles = set()
        self.tile_source = tile_source
        self.tile_zoom = tile_zoom

    async def ensure_coverage(self, lat, lon, extend=0.0):
        tiles = self.tile_source.get_required_tiles(
            lat, lon, self.tile_zoom, extend=extend
        )
        for tile in tiles:
            await self.add_tile(*tile)

    def get_way_by_id(self, way_id):
        if way_id and way_id in self.ways:
            return self.ways[way_id]
        else:
            return None

    async def add_tile(self, z, x, y):
        # skip if already in tile list
        if (z, x, y) in self.loaded_tiles:
            return

        # # request tile, will be returned as a node-way-relation-split
        ways = self.tile_source.get_tile(z, x, y)

        # add way objects, and store
        async for way in ways:
            if way.way_id in self.ways:
                continue

            self.ways[way.way_id] = way
            self.way_container.insert(way)

        # update tile list
        self.loaded_tiles.add((z, x, y))

    def get_map_center(self):
        lat = np.mean([node["lat"] for node in self.nodes.values()])
        lon = np.mean([node["lon"] for node in self.nodes.values()])
        return lat, lon

    def find_approximate_near_ways(self, lat_lon, d_max):
        return self.way_container.find_near_candidates(lat_lon, d_max=d_max)
