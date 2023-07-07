#!/usr/bin/env python3

from dataclasses import dataclass
import asyncio
from os.path import basename, splitext
import sys
import logging

import msgpack
import psycopg

from obs.api.app import app
from obs.api.utils import chunk

log = logging.getLogger(__name__)


ROAD_BUFFER = 1000
AREA_BUFFER = 100


@dataclass
class Road:
    way_id: int
    name: str
    zone: str
    directionality: int
    oneway: int
    geometry: bytes


def read_file(filename):
    """
    Reads a file iteratively, yielding
    appear. Those may be mixed.
    """

    with open(filename, "rb") as f:
        unpacker = msgpack.Unpacker(f)
        try:
            while True:
                type_id, *data = unpacker.unpack()

                if type_id == b"\x01":
                    yield Road(*data)

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
        log.info("Pass 1: Delete previously imported data")

        log.debug("Delete import group %s", import_group)
        await cursor.execute(
            "DELETE FROM road WHERE import_group = %s", (import_group,)
        )

        log.debug("Delete roads by way_id")
        for ids in chunk(road_ids, 10000):
            await cursor.execute("DELETE FROM road WHERE way_id = ANY(%s)", (ids,))

        # Pass 2: Import
        log.info("Pass 2: Import roads")
        amount = 0
        for items in chunk(read_file(filename), 10000):
            amount += 10000
            log.info(f"...{amount}/{len(road_ids)} ({100*amount/len(road_ids)}%)")
            async with cursor.copy(
                "COPY road (way_id, name, zone, directionality, oneway, geometry, import_group) FROM STDIN"
            ) as copy:
                for item in items:
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
    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")

    url = app.config.POSTGRES_URL
    url = url.replace("+asyncpg", "")

    async with await psycopg.AsyncConnection.connect(url) as connection:
        for filename in sys.argv[1:]:
            log.debug("Loading file: %s", filename)
            await import_osm(connection, filename)


if __name__ == "__main__":
    asyncio.run(main())
