# Copyright (C) 2020-2021 OpenBikeSensor Contributors
# Contact: https://openbikesensor.org
#
# This file is part of the OpenBikeSensor Scripts.
#
# The OpenBikeSensor Scripts are free software: you can redistribute it and/or
# modify it under the terms of the GNU Lesser General Public License as
# published by the Free Software Foundation, either version 3 of the License,
# or (at your option) any later version.
#
# The OpenBikeSensor Scripts are distributed in the hope that it will be
# useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser
# General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public License
# along with the OpenBikeSensor Scripts.  If not, see
# <http://www.gnu.org/licenses/>.

import requests
import numpy as np
import logging

from joblib import Memory


class DataSource:
    def __init__(self, areas=None, cache_dir="cache", query_family="roads_in_admin_boundary"):
        if areas is None:
            areas = ["Stuttgart"]

        self.areas = areas

        self.memory = Memory(cache_dir, verbose=0, compress=True)
        self.get_cached = self.memory.cache(requests.get)

        self.overpass_url = "http://overpass-api.de/api/interpreter"

        self.query_templates = {
            "roads_in_admin_boundary": """
            [out:json];
            area[name="Deutschland"];
            rel[name~"{name_pattern}"]["boundary"="administrative"](area);
            map_to_area;
            (way["highway"~"trunk|primary|secondary|tertiary|unclassified|residential|trunk_link|primary_link|secondary_link|tertiary_link|living_street|service|track|road"](area);>;);
            out body;
            """
            }

        data, self.data_id = self.read(areas, query_family)

        self.nodes, self.ways = self.convert_to_dict(data)

    def read(self, areas, name_query):
        # construct a regular search pattern from list of areas
        # ["Stuttgart", "Pforzheim", "Enzkreis"] results in
        # "^Stuttgart$|^Pforzheim$|^Enzkreis$"
        name_pattern = "|".join(
            ["^" + area + "$" for area in areas]
        )

        # construct the query
        query = self.query_templates[name_query].format(name_pattern=name_pattern)

        logging.debug("sending query to self.overpass_url\m" + query)

        # send it and receive answer
        response = self.get_cached(self.overpass_url,
                                   params={'data': query})

        time = response.headers["Date"]

        data_id = query + time

        data = response.json()

        return data, data_id

    def get_map_center(self):
        lat = np.mean([node["lat"] for node in self.nodes.values()])
        lon = np.mean([node["lon"] for node in self.nodes.values()])

        return lat, lon

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
