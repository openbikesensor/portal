#!/usr/bin/env python3
import logging
import asyncio
import argparse

from obs.api.db import drop_all, init_models, connect_db
from obs.api.app import app

log = logging.getLogger(__name__)


async def main():
    parser = argparse.ArgumentParser(
        description="drops the whole database, and possibly creates new table schema"
    )

    parser.add_argument(
        "-s",
        "--create-schema",
        action="store_true",
        help="create the schema",
    )

    args = parser.parse_args()

    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")

    async with connect_db(app.config.POSTGRES_URL):
        await drop_all()
        if args.create_schema:
            await init_models()
        log.info("Database initialized.")


if __name__ == "__main__":
    asyncio.run(main())
