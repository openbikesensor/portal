import json
from enum import Enum
from contextlib import contextmanager
import zipfile
import io
from sqlite3 import connect

import shapefile
from obs.api.db import OvertakingEvent
from sqlalchemy import select, func
from sanic.response import raw
from sanic.exceptions import InvalidUsage

from obs.api.app import app, json as json_response

from .mapdetails import get_single_arg


class ExportFormat(str, Enum):
    SHAPEFILE = "shapefile"
    GEOJSON = "geojson"


def parse_bounding_box(input_string):
    left, bottom, right, top = map(float, input_string.split(","))
    return func.ST_SetSRID(
        func.ST_MakeBox2D(
            func.ST_Point(left, bottom),
            func.ST_Point(right, top),
        ),
        3857,
    )


PROJECTION_4326 = (
    'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],'
    'AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],'
    'UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]'
)


@contextmanager
def shapefile_zip():
    zip_buffer = io.BytesIO()
    shp, shx, dbf = (io.BytesIO() for _ in range(3))
    writer = shapefile.Writer(
        shp=shp, shx=shx, dbf=dbf, shapeType=shapefile.POINT, encoding="utf8"
    )

    yield writer, zip_buffer

    writer.balance()
    writer.close()

    zip_file = zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False)
    zip_file.writestr("events.shp", shp.getbuffer())
    zip_file.writestr("events.shx", shx.getbuffer())
    zip_file.writestr("events.dbf", dbf.getbuffer())
    zip_file.writestr("events.prj", PROJECTION_4326)
    zip_file.close()


@app.get(r"/export/events")
async def export_events(req):
    bbox = get_single_arg(
        req, "bbox", default="-180,-90,180,90", convert=parse_bounding_box
    )
    fmt = get_single_arg(req, "fmt", convert=ExportFormat)

    events = await req.ctx.db.stream_scalars(
        select(OvertakingEvent).where(OvertakingEvent.geometry.bool_op("&&")(bbox))
    )

    if fmt == ExportFormat.SHAPEFILE:
        with shapefile_zip() as (writer, zip_buffer):
            writer.field("distance_overtaker", "N", decimal=4)
            writer.field("distance_stationary", "N", decimal=4)
            writer.field("way_id", "N", decimal=0)
            writer.field("direction", "N", decimal=0)
            writer.field("course", "N", decimal=4)
            writer.field("speed", "N", decimal=4)

            async for event in events:
                writer.point(event.longitude, event.latitude)
                writer.record(
                    distance_overtaker=event.distance_overtaker,
                    distance_stationary=event.distance_stationary,
                    direction=-1 if event.direction_reversed else 1,
                    way_id=event.way_id,
                    course=event.course,
                    speed=event.speed,
                    # "time"=event.time,
                )

        return raw(zip_buffer.getbuffer())

    if fmt == ExportFormat.GEOJSON:
        features = []
        async for event in events:
            features.append(
                {
                    "type": "Feature",
                    "geometry": json.loads(event.geometry),
                    "properties": {
                        "distance_overtaker": event.distance_overtaker,
                        "distance_stationary": event.distance_stationary,
                        "direction": -1 if event.direction_reversed else 1,
                        "way_id": event.way_id,
                        "course": event.course,
                        "speed": event.speed,
                        "time": event.time,
                    },
                }
            )

        geojson = {"type": "FeatureCollection", "features": features}
        return json_response(geojson)

    raise InvalidUsage("unknown export format")
