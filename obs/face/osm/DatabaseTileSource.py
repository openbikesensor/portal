import logging
import json

from sqlalchemy import delete, func, select
import numpy as np

try:
    from obs.api.db import Road
except ImportError:
    Road = None

from .TileSource import TileSource

log = logging.getLogger(__name__)


class DatabaseTileSource(TileSource):
    def __init__(self, sessionmaker):
        if Road is None:
            raise RuntimeError(
                "Failed to import obs.api.db, so DatabaseTileSource cannot be used. Please install the obs-api in the current environment."
            )

        self.sessionmaker = sessionmaker

    async def get_tile(self, z, x, y):
        async with self.sessionmaker() as session:
            roads = await session.execute(
                select(
                    [
                        Road.way_id,
                        Road.tags,
                        func.ST_AsGeoJSON(func.ST_Transform(Road.geometry, 4326)),
                    ]
                ).where(Road.geometry.bool_op("&&")(func.ST_TileEnvelope(z, x, y)))
            )
            roads = roads.all()

            log.debug("Found %d roads in tile (%d, %d, %d).", len(roads), z, x, y)

            for way_id, tags, geometry in roads:
                yield way_id, tags, np.flip(
                    np.array(json.loads(geometry)["coordinates"]), axis=1
                )
