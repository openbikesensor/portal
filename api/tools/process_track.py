#!/usr/bin/env python3
import argparse
import logging
import asyncio

from obs.face.osm import DataSource, DatabaseTileSource, OverpassTileSource

from obs.api.db import make_session, connect_db, make_session
from obs.api.app import app
from obs.api.process import process_tracks, process_tracks_loop

log = logging.getLogger(__name__)


async def main():
    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")

    parser = argparse.ArgumentParser(
        description="processes a single track for use in the portal, "
        "using the obs.face algorithms"
    )

    parser.add_argument(
        "--loop-delay",
        action="store",
        type=int,
        default=10,
        help="delay between loops, if no track was found in the queue (polling)",
    )

    parser.add_argument(
        "tracks",
        metavar="ID_OR_SLUG",
        nargs="*",
        help="ID or slug of tracks to process, if not passed, the queue is processed in a loop",
    )

    args = parser.parse_args()

    async with connect_db(app.config.POSTGRES_URL):
        log.info("Loading OpenStreetMap data")
        tile_source = DatabaseTileSource()
        # tile_source = OverpassTileSource(app.config.OBS_FACE_CACHE_DIR)
        data_source = DataSource(tile_source)

        if args.tracks:
            async with make_session() as session:
                await process_tracks(session, data_source, args.tracks)
        else:
            await process_tracks_loop(data_source, args.loop_delay)


if __name__ == "__main__":
    asyncio.run(main())
