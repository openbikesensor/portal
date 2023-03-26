#!/usr/bin/env python3

from dataclasses import asdict, dataclass
import asyncio
from os.path import basename, splitext
import sys
import logging

import msgpack
import psycopg
from psycopg.types import TypeInfo
from psycopg.types.shapely import register_shapely
from shapely.wkb import loads

from obs.api.app import app
from obs.api.db import ZoneType, connect_db, make_session
from obs.api.utils import chunk

log = logging.getLogger(__name__)


ROAD_BUFFER = 1000
AREA_BUFFER = 100


@dataclass
class Region:
    relation_id: int
    name: str
    admin_level: int
    geometry: bytes


@dataclass
class Road:
    way_id: int
    name: str
    zone: str
    directionality: int
    oneway: int
    geometry: bytes


def read_file(filename, type_only=False):
    """
    Reads a file iteratively, yielding Road and Region objects as they
    appear. Those may be mixed.
    """
    with open(filename, "rb") as f:
        unpacker = msgpack.Unpacker(f)
        try:
            while True:
                type_id = unpacker.unpack()
                data = unpacker.unpack()

                if type_id == b"\x01":
                    yield Road(*data)

                # elif type_id == b"\x02":
                #     yield Region(*data)
        except msgpack.OutOfData:
            pass


async def import_osm(connection, filename, import_group=None):
    if import_group is None:
        import_group = splitext(basename(filename))[0]

    # Pass 1: Find IDs only
    road_ids = []
    for item in read_file(filename):
        road_ids.append(item.way_id)

    async with connection.cursor() as cursor:
        print(f"Pass 1: Delete previous")

        print(f"Deleting import group {import_group}")
        await cursor.execute(
            "DELETE FROM road WHERE import_group = %s", (import_group,)
        )

        print(f"Deleting by ID")
        for ids in chunk(road_ids, 10000):
            await cursor.execute("DELETE FROM road WHERE way_id = ANY(%s)", (ids,))

        # Pass 2: Import
        print(f"Pass 2: Import")

        async with cursor.copy(
            "COPY road (way_id, name, zone, directionality, oneway, geometry, import_group) FROM STDIN"
        ) as copy:
            for item in read_file(filename):
                await copy.write_row(
                    (
                        item.way_id,
                        item.name,
                        item.zone,
                        item.directionality,
                        item.oneway,
                        bytes.hex(item.geometry),
                        import_group,
                    )
                )


async def main():
    url = app.config.POSTGRES_URL
    url = url.replace("+asyncpg", "")

    async with await psycopg.AsyncConnection.connect(url) as connection:
        for filename in sys.argv[1:]:
            print("Loading file", filename)
            await import_osm(connection, filename)


if __name__ == "__main__":
    asyncio.run(main())
