#!/usr/bin/env python3
import asyncio
import logging

log = logging.getLogger(__name__)

from prepare_sql_tiles import prepare_sql_tiles, _run

from import_regions import main as import_nuts

from reimport_tracks import main as reimport_tracks


async def _migrate():
    await _run("alembic upgrade head")


async def main():
    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")
    log.info("Running migrations...")
    await _migrate()
    log.info("Preparing SQL tiles...")
    await prepare_sql_tiles()
    log.info("Importing nuts regions...")
    await import_nuts()
    log.info("Nuts regions imported, scheduling reimport of tracks")
    await reimport_tracks()



if __name__ == "__main__":
    asyncio.run(main())
