import json
from functools import partial
import logging
import numpy
import math
import pyproj


from sqlalchemy import select, func, column, text

from shapely import LineString

import sanic.response as response
from sanic.exceptions import InvalidUsage

from obs.api.app import api
from obs.api.db import Road, RoadUsage, OvertakingEvent, Track
from obs.api.utils import round_to

round_distance = partial(round_to, multiples=0.001)
round_speed = partial(round_to, multiples=0.1)

log = logging.getLogger(__name__)

g = pyproj.Geod(ellps='WGS84')


def get_bearing(p1, p2):
    (az12, az21, dist) = g.inv(p1[0], p1[1], p2[0], p2[1])
    bearing = (az12 + 360)%360
    return bearing


# Bins for histogram on overtaker distances. 0, 0.25, ... 2.25, infinity
DISTANCE_BINS = numpy.arange(0, 2.5, 0.25).tolist() + [float("inf")]


@api.route("/mapdetails/road", methods=["GET"])
async def mapdetails_road(req):
    longitude = req.ctx.get_single_arg("longitude", convert=float)
    latitude = req.ctx.get_single_arg("latitude", convert=float)
    radius = req.ctx.get_single_arg("radius", default=100, convert=float)

    if not (1 <= radius <= 1000):
        raise InvalidUsage("`radius` parameter must be between 1 and 1000")

    road_geometry = Road.geometry
    point = func.ST_Transform(
        func.ST_GeomFromGeoJSON(
            json.dumps(
                {
                    "type": "point",
                    "coordinates": [longitude, latitude],
                }
            )
        ),
        3857,
    )

    road = (
        await req.ctx.db.execute(
            select(Road)
            .where(func.ST_DWithin(road_geometry, point, radius))
            .order_by(func.ST_Distance(road_geometry, point))
            .limit(1)
        )
    ).scalar()

    length = await req.ctx.db.scalar(
        text(
            "select ST_Length(ST_GeogFromWKB(ST_Transform(geometry,4326))) from road where way_id=:wayid"
        ).bindparams(wayid=road.way_id)
    )
    if road is None:
        return response.json({})

    arrays = (
        await req.ctx.db.execute(
            select(
                OvertakingEvent.distance_overtaker,
                OvertakingEvent.distance_stationary,
                OvertakingEvent.speed,
                # Keep this as the last entry always for numpy.partition
                # below to work.
                OvertakingEvent.direction_reversed,
            )
            .select_from(OvertakingEvent)
            .where(OvertakingEvent.way_id == road.way_id)
        )
    ).all()

    arrays = numpy.array(arrays).T

    if len(arrays) == 0:
        arrays = numpy.array([[], [], [], []], dtype=float)

    data, mask = arrays[:-1], arrays[-1]
    data = data.astype(numpy.float64)
    mask = mask.astype(bool)

    def partition(arr, cond):
        return arr[:, cond], arr[:, ~cond]

    def array_stats(arr, rounder, bins=30):
        if len(arr):
            arr = arr[~numpy.isnan(arr)]

        n = len(arr)

        hist, bins = numpy.histogram(arr, bins=bins)

        return {
            "statistics": {
                "count": n,
                "mean": rounder(numpy.mean(arr)) if n else None,
                "min": rounder(numpy.min(arr)) if n else None,
                "max": rounder(numpy.max(arr)) if n else None,
                "median": rounder(numpy.median(arr)) if n else None,
            },
            "histogram": {
                "bins": [None if math.isinf(b) else b for b in bins.tolist()],
                "counts": hist.tolist(),
                "zone": road.zone,
            },
            "values": list(map(rounder, arr.tolist())),
        }

    if not road.directionality:
        forwards, backwards = partition(data, ~mask)

        (road_usage,) = (
            await req.ctx.db.execute(
                text(
                    """
                    SELECT
                        count(*) FILTER (WHERE direction_reversed = false),
                        count(*) FILTER (WHERE direction_reversed = true)
                    FROM road_usage WHERE way_id=:wayid
                """
                ).bindparams(wayid=road.way_id)
            )
        ).all()

    else:
        road_usage_total = (
            await req.ctx.db.execute(
                text("SELECT count(*) FROM road_usage WHERE way_id=:wayid").bindparams(
                    wayid=road.way_id
                )
            )
        ).scalar()
        print(road_usage_total)

    bearing = None

    geom = json.loads(road.geometry)
    if geom["type"] == "LineString":
        coordinates = geom["coordinates"]
        bearing = get_bearing(coordinates[0], coordinates[-1])
        # convert to degrees, as this is more natural to understand for consumers
        bearing = round_to(bearing, 1)

    def get_direction_stats(direction_arrays, usage, backwards=False):
        return {
            "bearing": ((bearing + 180) % 360 if backwards else bearing)
            if bearing is not None
            else None,
            "count": len(direction_arrays[0][~numpy.isnan(direction_arrays[0])]),
            "below_150": len(direction_arrays[0][direction_arrays[0] < 1.50]),
            "roadUsage": usage,
            "distanceOvertaker": array_stats(
                direction_arrays[0], round_distance, bins=DISTANCE_BINS
            ),
            "distanceStationary": array_stats(
                direction_arrays[1], round_distance, bins=DISTANCE_BINS
            ),
            "speed": array_stats(direction_arrays[2], round_speed),
        }

    result = {
        "road": road.to_dict(),
        "length": length,
    }
    if not road.directionality:
        result["forwards"] = get_direction_stats(forwards, road_usage[0])
        result["backwards"] = get_direction_stats(backwards, road_usage[1], True)
    else:
        result["oneway"] = get_direction_stats(data, road_usage_total)

    return response.json(result)
