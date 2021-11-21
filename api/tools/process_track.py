#!/usr/bin/env python3
import argparse
import logging
import asyncio

from obs.api.db import connect_db
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
        if args.tracks:
            await process_tracks(args.tracks)
        else:
            await process_tracks_loop(args.loop_delay)


if __name__ == "__main__":
    asyncio.run(main())
