#!/usr/bin/env python3
import logging
import asyncio
from alembic.config import Config
from alembic import command
from os.path import join, dirname

log = logging.getLogger(__name__)

from prepare_sql_tiles import prepare_sql_tiles, _run


async def _migrate():
    await _run("alembic upgrade head")


async def main():
    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")
    log.info("Running migrations...")
    await _migrate()
    log.info("Preparing SQL tiles...")
    await prepare_sql_tiles()
    log.info("Upgraded")


if __name__ == "__main__":
    asyncio.run(main())
