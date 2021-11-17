#!/usr/bin/env python3
import logging
import asyncio

from obs.api.db import init_models, connect_db
from obs.api.app import app

log = logging.getLogger(__name__)


async def main():
    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")

    async with connect_db(app.config.POSTGRES_URL):
        await init_models()
        log.info("Database initialized.")


if __name__ == "__main__":
    asyncio.run(main())
