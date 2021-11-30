import json
from functools import partial
import numpy

from sqlalchemy import select, func, column

import sanic.response as response
from sanic.exceptions import InvalidUsage

from obs.api.app import api
from obs.api.db import Road, OvertakingEvent, Track


from .stats import round_to

round_distance = partial(round_to, multiples=0.001)
round_speed = partial(round_to, multiples=0.1)

RAISE = object()


def get_single_arg(req, name, default=RAISE, convert=None):
    try:
        value = req.args[name][0]
    except LookupError as e:
        if default is not RAISE:
            return default
        raise InvalidUsage("missing `{name}`") from e

    if convert is not None:
        try:
            value = convert(value)
        except (ValueError, TypeError) as e:
            raise InvalidUsage("invalid `{name}`") from e

    return value


@api.route("/mapdetails/road", methods=["GET"])
async def mapdetails_road(req):
    longitude = get_single_arg(req, "longitude", convert=float)
    latitude = get_single_arg(req, "latitude", convert=float)
    radius = get_single_arg(req, "radius", default=100, convert=float)

    if not (1 <= radius <= 1000):
        raise InvalidUsage("`radius` parameter must be between 1 and 1000")

    road_geometry = func.ST_Transform(Road.geometry, 3857)
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

    if road is None:
        return response.json({})

    arrays = (
        await req.ctx.db.execute(
            select(
                [
                    OvertakingEvent.distance_overtaker,
                    OvertakingEvent.distance_stationary,
                    OvertakingEvent.speed,
                ]
            ).where(OvertakingEvent.way_id == road.way_id)
        )
    ).all()

    arrays = numpy.array(arrays).T.astype(numpy.float64)

    def array_stats(arr, rounder):
        arr = arr[~numpy.isnan(arr)]
        n = len(arr)
        return {
            "statistics": {
                "count": len(arr),
                "mean": rounder(numpy.mean(arr)) if n else None,
                "min": rounder(numpy.min(arr)) if n else None,
                "max": rounder(numpy.max(arr)) if n else None,
                "median": rounder(numpy.median(arr)) if n else None,
            },
            "values": list(map(rounder, arr.tolist())),
        }

    return response.json(
        {
            "road": road.to_dict(),
            "distanceOvertaker": array_stats(arrays[0], round_distance),
            "distanceStationary": array_stats(arrays[1], round_distance),
            "speed": array_stats(arrays[2], round_speed),
        }
    )
