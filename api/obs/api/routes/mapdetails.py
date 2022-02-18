import json
from functools import partial
import numpy
import math

from sqlalchemy import select, func, column

import sanic.response as response
from sanic.exceptions import InvalidUsage

from obs.api.app import api
from obs.api.db import Road, OvertakingEvent, Track
from obs.api.utils import round_to

round_distance = partial(round_to, multiples=0.001)
round_speed = partial(round_to, multiples=0.1)


def get_bearing(a, b):
    # longitude, latitude
    dL = b[0] - a[0]
    X = numpy.cos(b[1]) * numpy.sin(dL)
    Y = numpy.cos(a[1]) * numpy.sin(b[1]) - numpy.sin(a[1]) * numpy.cos(
        b[1]
    ) * numpy.cos(dL)
    return numpy.arctan2(X, Y)


@api.route("/mapdetails/road", methods=["GET"])
async def mapdetails_road(req):
    longitude = req.ctx.get_single_arg("longitude", convert=float)
    latitude = req.ctx.get_single_arg("latitude", convert=float)
    radius = req.ctx.get_single_arg("radius", default=100, convert=float)

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
                    # Keep this as the last entry always for numpy.partition
                    # below to work.
                    OvertakingEvent.direction_reversed,
                ]
            ).where(OvertakingEvent.way_id == road.way_id)
        )
    ).all()

    arrays = numpy.array(arrays).T

    if len(arrays) == 0:
        arrays = numpy.array([[], [], [], []], dtype=numpy.float)

    data, mask = arrays[:-1], arrays[-1]
    data = data.astype(numpy.float64)
    mask = mask.astype(numpy.bool)

    def partition(arr, cond):
        return arr[:, cond], arr[:, ~cond]

    forwards, backwards = partition(data, ~mask)
    print("for", forwards.dtype, "back", backwards.dtype)

    def array_stats(arr, rounder):
        if len(arr):
            print("ARR DTYPE", arr.dtype)
            print("ARR", arr)
            arr = arr[~numpy.isnan(arr)]

        n = len(arr)

        return {
            "statistics": {
                "count": n,
                "mean": rounder(numpy.mean(arr)) if n else None,
                "min": rounder(numpy.min(arr)) if n else None,
                "max": rounder(numpy.max(arr)) if n else None,
                "median": rounder(numpy.median(arr)) if n else None,
            },
            "values": list(map(rounder, arr.tolist())),
        }

    bearing = None

    geom = json.loads(road.geometry)
    if geom["type"] == "LineString":
        coordinates = geom["coordinates"]
        bearing = get_bearing(coordinates[0], coordinates[-1])
        # convert to degrees, as this is more natural to understand for consumers
        bearing = round_to((bearing / math.pi * 180 + 360) % 360, 1)

    print(road.geometry)

    def get_direction_stats(direction_arrays, backwards=False):
        return {
            "bearing": ((bearing + 180) % 360 if backwards else bearing)
            if bearing is not None
            else None,
            "distanceOvertaker": array_stats(direction_arrays[0], round_distance),
            "distanceStationary": array_stats(direction_arrays[1], round_distance),
            "speed": array_stats(direction_arrays[2], round_speed),
        }

    return response.json(
        {
            "road": road.to_dict(),
            "forwards": get_direction_stats(forwards),
            "backwards": get_direction_stats(backwards, True),
        }
    )
