import logging
import json

from sqlalchemy import delete, func, select
import numpy as np

try:
    from obs.api.db import Road, make_session
except ImportError:
    pass

from .TileSource import TileSource
from .Way import Way

log = logging.getLogger(__name__)


class DatabaseTileSource(TileSource):
    def __init__(self):
        if Road is None:
            raise RuntimeError(
                "Failed to import obs.api.db, so DatabaseTileSource cannot be used. Please install the obs-api in the current environment."
            )

    async def get_tile(self, z, x, y):
        if make_session is None:
            raise RuntimeError(
                "Failed to import obs.api.db, so DatabaseTileSource cannot be used. Please install the obs-api in the current environment."
            )

        async with make_session() as session:
            roads = await session.execute(
                select(
                    Road.way_id,
                    Road.zone,
                    Road.oneway,
                    Road.name,
                    Road.directionality,
                    func.ST_AsGeoJSON(func.ST_Transform(Road.geometry, 4326)),
                )
                .select_from(Road)
                .where(Road.geometry.bool_op("&&")(func.ST_TileEnvelope(z, x, y)))
            )
            roads = roads.all()

            log.debug("Found %d roads in tile (%d, %d, %d).", len(roads), z, x, y)

            for way_id, zone, oneway, name, directionality, geometry in roads:
                coordinates = np.flip(
                    np.array(json.loads(geometry)["coordinates"]), axis=1
                )

                yield Way(way_id, coordinates, zone, oneway, name, directionality)
