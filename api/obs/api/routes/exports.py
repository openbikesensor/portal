import json
from enum import Enum
from contextlib import contextmanager
import zipfile
import io
import re
from sqlite3 import connect

import shapefile
from obs.api.db import OvertakingEvent
from sqlalchemy import select, func, text
from sanic.response import raw
from sanic.exceptions import InvalidUsage

from obs.api.app import api, json as json_response
from obs.api.utils import use_request_semaphore


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
        4326,
    )


PROJECTION_4326 = (
    'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],'
    'AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],'
    'UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]'
)


@contextmanager
def shapefile_zip(shape_type=shapefile.POINT, basename="events"):
    zip_buffer = io.BytesIO()
    shp, shx, dbf = (io.BytesIO() for _ in range(3))
    writer = shapefile.Writer(
        shp=shp, shx=shx, dbf=dbf, shapeType=shape_type, encoding="utf8"
    )

    yield writer, zip_buffer

    writer.balance()
    writer.close()

    zip_file = zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False)
    zip_file.writestr(f"{basename}.shp", shp.getbuffer())
    zip_file.writestr(f"{basename}.shx", shx.getbuffer())
    zip_file.writestr(f"{basename}.dbf", dbf.getbuffer())
    zip_file.writestr(f"{basename}.prj", PROJECTION_4326)
    zip_file.close()


@api.get(r"/export/events")
async def export_events(req):
    async with use_request_semaphore(req, "export_semaphore", timeout=30):
        bbox = req.ctx.get_single_arg(
            "bbox", default="-180,-90,180,90", convert=parse_bounding_box
        )
        fmt = req.ctx.get_single_arg("fmt", convert=ExportFormat)

        events = await req.ctx.db.stream_scalars(
            select(OvertakingEvent).where(
                OvertakingEvent.geometry.bool_op("&&")(func.ST_Transform(bbox, 3857))
            )
        )

        if fmt == ExportFormat.SHAPEFILE:
            with shapefile_zip(basename="events") as (writer, zip_buffer):
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


@api.get(r"/export/segments")
async def export_segments(req):
    async with use_request_semaphore(req, "export_semaphore", timeout=30):
        bbox = req.ctx.get_single_arg(
            "bbox", default="-180,-90,180,90"
        )
        assert re.match(r"(-?\d+\.?\d+,?){4}", bbox)
        fmt = req.ctx.get_single_arg("fmt", convert=ExportFormat)
        segments = await req.ctx.db.stream(
            text(
                f"select ST_AsGeoJSON(ST_Transform(road.geometry,4326)) AS geometry, ST_Length(ST_GeogFromWKB(ST_Transform(road.geometry,4326)))::integer as segment_length, road.name as name, road.way_id, distance_overtaker_mean, distance_overtaker_min,distance_overtaker_max,distance_overtaker_median,overtaking_event_count,usage_count,direction,road.zone,offset_direction,distance_overtaker_array from layer_obs_roads(ST_Transform(ST_MakeEnvelope({bbox},4326),3857),11,NULL,'1900-01-01'::timestamp,'2100-01-01'::timestamp) JOIN road ON road.way_id = layer_obs_roads.way_id WHERE usage_count>0 "
            )
        )

        if fmt == ExportFormat.SHAPEFILE:
            with shapefile_zip(shape_type=3, basename="segments") as (writer, zip_buffer):
                writer.field("distance_overtaker_mean", "N", decimal=4)
                writer.field("distance_overtaker_max", "N", decimal=4)
                writer.field("distance_overtaker_min", "N", decimal=4)
                writer.field("distance_overtaker_median", "N", decimal=4)
                writer.field("overtaking_event_count", "N", decimal=4)
                writer.field("usage_count", "N", decimal=4)
                writer.field("way_id", "N", decimal=0)
                writer.field("direction", "N", decimal=0)
                writer.field("segment_length", "N", decimal=4)
                writer.field("name", "C")
                writer.field("zone", "C")

                async for segment in segments:
                    geom = json.loads(segment.st_asgeojson)
                    writer.line([geom["coordinates"]])
                    writer.record(
                        distance_overtaker_mean=segment.distance_overtaker_mean,
                        distance_overtaker_median=segment.distance_overtaker_median,
                        distance_overtaker_max=segment.distance_overtaker_max,
                        distance_overtaker_min=segment.distance_overtaker_min,
                        usage_count=segment.usage_count,
                        overtaking_event_count=segment.overtaking_event_count,
                        direction=segment.direction,
                        segment_length=segment.segment_length,
                        way_id=segment.way_id,
                        zone=segment.zone,
                        name=segment.name,
                    )

            return raw(zip_buffer.getbuffer())

        if fmt == ExportFormat.GEOJSON:
            features = []
            async for segment in segments:
                features.append(
                    {
                        "type": "Feature",
                        "geometry": json.loads(segment.geometry),
                        "properties": {
                            "distance_overtaker_mean": segment.distance_overtaker_mean,
                            "distance_overtaker_max": segment.distance_overtaker_max,
                            "distance_overtaker_median": segment.distance_overtaker_median,
                            "overtaking_event_count": segment.overtaking_event_count,
                            "usage_count": segment.usage_count,
                            "distance_overtaker_array": segment.distance_overtaker_array,
                            "direction": segment.direction,
                            "segment_length": segment.segment_length,
                            "name": segment.name,
                            "way_id": segment.way_id,
                            "zone": segment.zone,
                        },
                    }
                )

            geojson = {"type": "FeatureCollection", "features": features}
            return json_response(geojson)

        raise InvalidUsage("unknown export format")
