#!/usr/bin/env python3
import logging
import asyncio

from sqlalchemy import text

from obs.api.app import app
from obs.api.db import connect_db, make_session

log = logging.getLogger(__name__)

async def main():
    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")
    await reimport_tracks()


async def reimport_tracks():

    async with connect_db(
        app.config.POSTGRES_URL,
        app.config.POSTGRES_POOL_SIZE,
        app.config.POSTGRES_MAX_OVERFLOW,
    ):
        async with make_session() as session:
            await session.execute(text("UPDATE track SET processing_status = 'queued';"))
            await session.commit()


if __name__ == "__main__":
    asyncio.run(main())
