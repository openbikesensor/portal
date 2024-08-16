# Copyright (C) 2020-2021 OpenBikeSensor Contributors
# Contact: https://openbikesensor.org
#
# This file is part of the OpenBikeSensor Portal Software.
#
# The OpenBikeSensor Portal Software is free software: you can redistribute it and/or
# modify it under the terms of the GNU Lesser General Public License as
# published by the Free Software Foundation, either version 3 of the License,
# or (at your option) any later version.
#
# The OpenBikeSensor Portal Software is distributed in the hope that it will be
# useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser
# General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public License
# along with the OpenBikeSensor Portal Software.  If not, see
# <http://www.gnu.org/licenses/>.

from collections import defaultdict
from dataclasses import dataclass
from functools import cached_property, partial
from typing import Optional

import numpy as np
import pandas as pd
from pyproj import Transformer
import shapely
from shapely.geometry import MultiPoint
from shapely.ops import transform
from shapely.wkb import dumps as dump_wkb
from sqlalchemy import func, select
from transformations import unit_vector

from obs.api.db import Road

# https://epsg.io/4326 -- World Geodetic System 1984, used in GPS
WSG84 = "EPSG:4326"  # degrees lat/lng WSG84

# https://epsg.io/3857 -- WGS 84 / Pseudo-Mercator (e. g. OpenStreetMap)
WEB_MERCATOR = "EPSG:3857"

wsg84_to_mercator = partial(
    transform, Transformer.from_crs(WSG84, WEB_MERCATOR, always_xy=True).transform
)
mercator_to_wsg84 = partial(
    transform, Transformer.from_crs(WEB_MERCATOR, WSG84, always_xy=True).transform
)


async def load_roads(session, track_points: MultiPoint, buffer):
    """
    Loads all those roads from the database that are in the vicinity of the
    provided track. The distance to the track is given in meters via `buffer`.

    Road.geometry and track_points are both in mercator projection, and the
    unit for distance in that projection is meters, so the buffer is in
    meters.
    """
    query = select(Road).where(
        func.ST_DWithin(
            Road.geometry,
            func.ST_GeomFromEWKB(dump_wkb(track_points, srid=3857)),
            buffer,
        )
    )

    return list((await session.execute(query)).scalars())


def create_road_lookup(roads, track: MultiPoint, buffer: float):
    """
    Produces a lookup table for each point on the track (by index)
    that contains a list of roads in its buffer radius. Each entry
    in the list is a tuple of (distance, road, road_geometry).
    """
    points = track.geoms

    roads_by_index, road_geometries = zip(
        *[
            (road, wsg84_to_mercator(shapely.from_geojson(road.geometry)))
            for road in roads
        ]
    )

    tree = shapely.STRtree(road_geometries)
    lookup = defaultdict(list)
    for point_index, road_index in tree.query(points, "dwithin", buffer).T:
        road_geometry = road_geometries[road_index]
        distance = road_geometry.distance(points[point_index])
        road = roads_by_index[road_index]
        lookup[point_index].append((distance, road, road_geometry))

    return lookup


def line_directions(line: MultiPoint, offset=1):
    c = shapely.to_ragged_array(line.geoms)[1]
    dirs = unit_vector(c[2 * offset :] - c[: -2 * offset], axis=1)
    dirs = np.concatenate([[dirs[0]] * offset, dirs, [dirs[-1]]] * offset)
    return dirs


def project_on_line(line, point, d=10):
    """
    Projects the point onto the line and determines the tangent direction of
    that point. Returns a tuple `(projected_point, tangent_vector)`.
    """
    loc = shapely.line_locate_point(line, point)
    target = shapely.line_interpolate_point(line, loc)

    a = shapely.line_interpolate_point(line, loc - d)
    b = shapely.line_interpolate_point(line, loc + d)
    diff = np.array([b.x - a.x, b.y - a.y])

    return target, unit_vector(diff)


def cost_by_direction_dot(dot, directionality):
    if directionality == 0:
        # normal two-way
        return 2 - abs(dot)

    if directionality < 0:
        dot *= -1

    if dot < 0:
        return (2 + dot) ** 2 * 0.7 + 0.3
    else:
        return (2 - dot) ** 2


def cost_by_angle(direction, road_direction, directionality):
    forward_angle = abs(angle_between(direction, road_direction))
    backward_angle = abs(angle_between(direction, road_direction * -1))

    if directionality > 0:
        used_angle = forward_angle
    elif directionality < 0:
        used_angle = backward_angle
    else:
        used_angle = min(forward_angle, backward_angle)

    return used_angle / np.pi


def get_factor_for_changing_way(a, b, road_distance):
    factor_go_offroad = 20
    factor_snap_back_onto_road = 0.5
    factor_stay_on_road = 1.0
    factor_stay_off_road = 40
    factor_switch_roads = 1
    factor_switch_roads_per_meter_jump = 10

    if a == 0 and b == 0:
        return factor_stay_off_road
    if a == b:
        return factor_stay_on_road
    if b == 0:
        return factor_go_offroad
    if a == 0:
        return factor_snap_back_onto_road

    if road_distance < 0.5:  # threshold
        return factor_switch_roads
    else:
        return road_distance * factor_switch_roads_per_meter_jump


def angle_between(v1, v2):
    v1_u = unit_vector(v1)
    v2_u = unit_vector(v2)
    return np.arccos(np.clip(np.dot(v1_u, v2_u), -1.0, 1.0))


def candidate_cost(distance_to_gps, road_direction_dot, directionality):
    cost_direction_factor = 15
    cost_per_meter_distance_to_gps = 0.1

    return (
        cost_by_direction_dot(road_direction_dot, directionality)
        * cost_direction_factor
    ) + distance_to_gps * cost_per_meter_distance_to_gps


@dataclass
class Candidate:
    cost: float
    distance_to_gps: float
    road_direction_dot: float
    road: Optional[Road]
    road_point: shapely.Point
    road_direction: np.ndarray
    road_geometry: shapely.Geometry
    direction: np.ndarray

    total_cost: float = 0
    chosen_previous: Optional["Candidate"] = None

    _road_point_buffered = None

    @property
    def road_point_buffered(self):
        if self._road_point_buffered is None:
            buffer = 30
            x, y = self.road_point.x, self.road_point.y
            self._road_point_buffered = shapely.box(
                x - buffer, y - buffer, x + buffer, y + buffer
            )
        return self._road_point_buffered


def edge_cost(c1: Candidate, c2: Candidate):
    cost_per_meter_travel_distance = 1
    distance_traveled = c1.road_point.distance(c2.road_point)

    # Remove all parts of the road geometry not in proximity to the snapping
    # point. Check how close the local road segment is to the other road, i. e
    # whether there is an intersection between those roads in the vicinity of
    # the current location (not somewhere unrelated)
    if not c2.road_geometry:
        road_distance = distance_traveled
    else:
        local_road = c2.road_point_buffered.intersection(c2.road_geometry)
        road_distance = local_road.distance(c1.road_geometry)

    change_way_factor = get_factor_for_changing_way(
        c1.road.way_id if c1.road else 0,
        c2.road.way_id if c2.road else 0,
        road_distance,
    )
    cost = distance_traveled * cost_per_meter_travel_distance * change_way_factor
    return c2.cost + cost


async def snap_to_roads(session, coordinates, buffer=120.0, choice_count=10):
    """
    coordinates: An array of longitude, latitude pairs.
    """

    point_count = len(coordinates)
    direction_offset = 5
    min_points = 2 * direction_offset + 1

    if point_count < min_points:
        raise ValueError("Too few points to process track.")

    # Create a raw point collection, and change it to the mercator projection,
    # in which we do all our computations
    track_points = wsg84_to_mercator(MultiPoint(coordinates))

    # Load roads that are within `buffer` meters to any point of the track.
    roads = await load_roads(session, track_points, buffer)

    if not roads:
        raise ValueError("No roads found in the import area.")

    # Figure out the roads in range of each point on the raw track, sorted by
    # bounding box distance.
    road_lookup = create_road_lookup(roads, track_points, buffer)

    # Compute the track directions (we ignore the "course" for now). We will use
    # this for snapping based on the direction of the line segment.
    track_directions = line_directions(track_points, offset=direction_offset)

    candidates_list = []

    for point_index, point in enumerate(track_points.geoms):
        direction = track_directions[point_index]

        # get road candidates
        candidates: list[Candidate] = []
        for distance_to_gps, road, road_geometry in road_lookup[point_index]:
            road_point, road_direction = project_on_line(road_geometry, point)
            road_direction_dot = np.dot(direction, road_direction)
            if np.isnan(road_direction_dot):
                road_direction_dot = 0

            cost = candidate_cost(
                distance_to_gps, road_direction_dot, road.directionality
            )
            candidates.append(
                Candidate(
                    cost,
                    distance_to_gps,
                    road_direction_dot,
                    road,
                    road_point,
                    road_direction,
                    road_geometry,
                    direction,
                )
            )

        candidates.sort(key=lambda c: c.cost)
        candidates = candidates[:choice_count]

        if not candidates:
            print("no candidate for point", point_index, point)
            candidates = [Candidate(0, 0, 1, None, point, direction, None, direction)]

        if candidates_list:
            prev_candidates = candidates_list[-1]
            for candidate in candidates:
                for prev_candidate in prev_candidates:
                    cost = edge_cost(
                        prev_candidate,
                        candidate,
                    )

                    if not isinstance(cost, float) and cost > 0:
                        raise ValueError(f"invalid cost: {cost}")

                    total_cost = prev_candidate.total_cost + cost
                    if (
                        candidate.chosen_previous is None
                        or total_cost < candidate.total_cost
                    ):
                        candidate.chosen_previous = prev_candidate
                        candidate.total_cost = total_cost

        candidates_list.append(candidates)

    backwards_path: list[Candidate] = []
    # find the best target candidate
    best_end_index = np.argmin([c.total_cost for c in candidates_list[-1]])
    c = candidates_list[-1][best_end_index]
    while c:
        backwards_path.append(c)
        c = c.chosen_previous

    result_candidates = list(reversed(backwards_path))

    coordinates_wsg80 = mercator_to_wsg84(
        MultiPoint([c.road_point for c in result_candidates])
    )

    return (
        [p.x for p in coordinates_wsg80.geoms],
        [p.y for p in coordinates_wsg80.geoms],
        [c.road.way_id if c.road else 0 for c in result_candidates],
        [c.road_direction_dot < 0 for c in result_candidates],
    )
