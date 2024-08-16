#!/usr/bin/env python3
import argparse
import logging
import asyncio

from obs.api.db import connect_db, make_session
from obs.api.app import app
from obs.api.process import process_track_file, process_tracks, process_tracks_loop
from obs.bin.openbikesensor_api import setup_logging

log = logging.getLogger(__name__)


async def main():
    setup_logging(debug=True)

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
        "--file",
        help="file to load, instead of reading from the database -- prints output",
    )

    parser.add_argument(
        "tracks",
        metavar="ID_OR_SLUG",
        nargs="*",
        help="ID or slug of tracks to process, if not passed, the queue is processed in a loop",
    )

    args = parser.parse_args()

    async with connect_db(
        app.config.POSTGRES_URL,
        app.config.POSTGRES_POOL_SIZE,
        app.config.POSTGRES_MAX_OVERFLOW,
    ):
        if args.file:
            async with make_session() as session:
                await process_track_file(session, args.file, args.file)
        elif args.tracks:
            await process_tracks(args.tracks)
        else:
            await process_tracks_loop(args.loop_delay)


if __name__ == "__main__":
    asyncio.run(main())
