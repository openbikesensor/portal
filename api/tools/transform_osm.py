#!/usr/bin/env python3

import sys
import re
import msgpack

import osmium
import shapely.wkb as wkb
from shapely.ops import transform

HIGHWAY_TYPES = {
    "trunk",
    "primary",
    "secondary",
    "tertiary",
    "unclassified",
    "residential",
    "trunk_link",
    "primary_link",
    "secondary_link",
    "tertiary_link",
    "living_street",
    "service",
    "track",
    "road",
}
ZONE_TYPES = {
    "urban",
    "rural",
    "motorway",
}
URBAN_TYPES = {
    "residential",
    "living_street",
    "road",
}
MOTORWAY_TYPES = {
    "motorway",
    "motorway_link",
}

ADMIN_LEVEL_MIN = 2
ADMIN_LEVEL_MAX = 8
MINSPEED_RURAL = 60

ONEWAY_YES = {"yes", "true", "1"}
ONEWAY_REVERSE = {"reverse", "-1"}


def parse_number(tag):
    if not tag:
        return None

    match = re.search(r"[0-9]+", tag)
    if not match:
        return None

    digits = match.group(0)
    try:
        return int(digits)
    except ValueError:
        return None


def determine_zone(tags):
    highway = tags.get("highway")
    zone = tags.get("zone:traffic")

    if zone is not None:
        if "rural" in zone:
            return "rural"

        if "motorway" in zone:
            return "motorway"

        return "urban"

    # From here on we are guessing based on other tags

    if highway in URBAN_TYPES:
        return "urban"

    if highway in MOTORWAY_TYPES:
        return "motorway"

    maxspeed_source = tags.get("source:maxspeed")
    if maxspeed_source and "rural" in maxspeed_source:
        return "rural"
    if maxspeed_source and "urban" in maxspeed_source:
        return "urban"

    for key in ["maxspeed", "maxspeed:forward", "maxspeed:backward"]:
        maxspeed = parse_number(tags.get(key))
        if maxspeed is not None and maxspeed > MINSPEED_RURAL:
            return "rural"

    # default to urban if we have no idea
    return "urban"


def determine_direction(tags, zone):
    if (
        tags.get("oneway") in ONEWAY_YES
        or tags.get("junction") == "roundabout"
        or zone == "motorway"
    ):
        return 1, True

    if tags.get("oneway") in ONEWAY_REVERSE:
        return -1, True

    return 0, False


class StreamPacker:
    def __init__(self, stream, *args, **kwargs):
        self.stream = stream
        self.packer = msgpack.Packer(*args, autoreset=False, **kwargs)

    def _write_out(self):
        if hasattr(self.packer, "getbuffer"):
            chunk = self.packer.getbuffer()
        else:
            chunk = self.packer.bytes()

        self.stream.write(chunk)
        self.packer.reset()

    def pack(self, *args, **kwargs):
        self.packer.pack(*args, **kwargs)
        self._write_out()

    def pack_array_header(self, *args, **kwargs):
        self.packer.pack_array_header(*args, **kwargs)
        self._write_out()

    def pack_map_header(self, *args, **kwargs):
        self.packer.pack_map_header(*args, **kwargs)
        self._write_out()

    def pack_map_pairs(self, *args, **kwargs):
        self.packer.pack_map_pairs(*args, **kwargs)
        self._write_out()


# A global factory that creates WKB from a osmium geometry
wkbfab = osmium.geom.WKBFactory()

from pyproj import Transformer

project = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True).transform


class OSMHandler(osmium.SimpleHandler):
    def __init__(self, packer):
        self.packer = packer
        super().__init__()

    def way(self, way):
        tags = way.tags

        highway = tags.get("highway")
        if not highway or highway not in HIGHWAY_TYPES:
            return

        zone = determine_zone(tags)
        directionality, oneway = determine_direction(tags, zone)
        name = tags.get("name")

        geometry = wkb.loads(wkbfab.create_linestring(way), hex=True)
        geometry = transform(project, geometry)
        geometry = wkb.dumps(geometry)
        self.packer.pack(
            [b"\x01", way.id, name, zone, directionality, oneway, geometry]
        )


with open(sys.argv[2], "wb") as fout:
    packer = StreamPacker(fout)
    osmhandler = OSMHandler(packer)
    osmhandler.apply_file(sys.argv[1], locations=True)
