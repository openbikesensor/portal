#!/usr/bin/env python3
import argparse
import logging
import os
import asyncio

from db import init_models, connect_db

log = logging.getLogger(__name__)


async def main():
    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")

    parser = argparse.ArgumentParser(
        description="clears the postgresql database and initializes the schema"
    )

    # https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING
    postgres_url_default = os.environ.get("POSTGRES_URL")
    parser.add_argument(
        "--postgres-url",
        required=postgres_url_default is None,
        action="store",
        help="connection string for postgres database, if set, the track result is imported there",
        default=postgres_url_default,
    )

    args = parser.parse_args()

    async with connect_db(args.postgres_url):
        await init_models()
        log.info("Database initialized.")


if __name__ == "__main__":
    asyncio.run(main())
