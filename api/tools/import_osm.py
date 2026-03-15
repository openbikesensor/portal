#!/usr/bin/env python3

from dataclasses import dataclass
import asyncio
from os.path import basename, splitext, isfile
import sys
import logging
from rich.progress import Progress

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


progress = Progress()
progress.start()


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


async def import_osm(connection, filename, import_group=None, overall=None):
    if import_group is None:
        import_group = splitext(basename(filename))[0]

    # Pass 1: Find IDs only
    road_ids = []
    for item in read_file(filename):
        road_ids.append(item.way_id)

    async with connection.cursor() as cursor:
        t0 = progress.add_task(f"Clean previous {import_group:<20}", total=2 * len(road_ids))
        await cursor.execute(
            "DELETE FROM road WHERE import_group = %s", (import_group,)
        )
        progress.update(t0, completed=len(road_ids))
        progress.update(overall, advance=0.25)

        for ids in chunk(road_ids, 10000):
            await cursor.execute("DELETE FROM road WHERE way_id = ANY(%s)", (ids,))
            progress.update(t0, advance=10000)
            progress.update(overall, advance=0.25 * 10000 / len(road_ids))

        # Pass 2: Import
        amount = 0
        progress.update(t0, visible=False)
        t1 = progress.add_task(f"Import {import_group:<20}...", total=len(road_ids))
        for items in chunk(read_file(filename), 10000):
            amount += 10000
            progress.update(t1, completed=amount)
            progress.update(overall, advance = 0.5 * 10000 / len(road_ids))
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
        progress.update(t1, visible=False)


async def main():
    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")

    url = app.config.POSTGRES_URL
    url = url.replace("+asyncpg", "")

    assert all([isfile(filename) for filename in sys.argv[1:]]), "please only pass filenames of .msgpack files as arguments"

    async with await psycopg.AsyncConnection.connect(url) as connection:
        overall = progress.add_task("Importing... ", total=len(sys.argv))
        file_number = 0
        for filename in sys.argv[1:]:
            await import_osm(connection, filename, overall=overall)
            progress.update(overall, completed=file_number)


if __name__ == "__main__":
    asyncio.run(main())
