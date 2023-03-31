#!/usr/bin/env python3

"""
This script downloads and/or imports regions for statistical analysis into the
PostGIS database. The regions are sourced from:

* EU countries are covered by
  [NUTS](https://ec.europa.eu/eurostat/web/gisco/geodata/reference-data/administrative-units-statistical-units/nuts).
"""

import tempfile
from dataclasses import dataclass
import json
import asyncio
from os.path import basename, splitext
import sys
import logging
from typing import Optional

import aiohttp
import psycopg

from obs.api.app import app
from obs.api.utils import chunk

log = logging.getLogger(__name__)

NUTS_URL = "https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_01M_2021_3857.geojson"

from pyproj import Transformer

project = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True).transform
from shapely.ops import transform
from shapely.geometry import shape
import shapely.wkb as wkb


async def import_nuts(
    connection, filename=None, level: int = 3, import_group: Optional[str] = None
):
    if import_group is None:
        import_group = f"nuts{level}"

    if filename:
        log.info("Load NUTS from file")
        with open(filename) as f:
            data = json.load(f)
    else:
        log.info("Download NUTS regions from europa.eu")
        async with aiohttp.ClientSession() as session:
            async with session.get(NUTS_URL) as resp:
                data = await resp.json(content_type=None)

    async with connection.cursor() as cursor:
        log.info(
            "Delete previously imported regions with import group %s", import_group
        )
        await cursor.execute(
            "DELETE FROM region WHERE import_group = %s", (import_group,)
        )

        log.info("Import regions")
        async with cursor.copy(
            "COPY region (id, name, geometry, import_group) FROM STDIN"
        ) as copy:
            for feature in data["features"]:
                if feature["properties"]["LEVL_CODE"] == level:
                    geometry = shape(feature["geometry"])
                    # geometry = transform(project, geometry)
                    geometry = wkb.dumps(geometry)
                    geometry = bytes.hex(geometry)
                    await copy.write_row(
                        (
                            feature["properties"]["NUTS_ID"],
                            feature["properties"]["NUTS_NAME"],
                            geometry,
                            import_group,
                        )
                    )


async def main():
    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")

    url = app.config.POSTGRES_URL
    url = url.replace("+asyncpg", "")

    async with await psycopg.AsyncConnection.connect(url) as connection:
        await import_nuts(connection, sys.argv[1])


if __name__ == "__main__":
    asyncio.run(main())
