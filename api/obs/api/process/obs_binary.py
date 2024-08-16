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

from dataclasses import dataclass, field
from functools import partial
import logging

import pandas
import numpy
from cobs import cobs
from haversine import haversine, Unit
import pyproj

from obs.proto import Time
from obs.proto.utils import parse_event

from .snapping import snap_to_roads

log = logging.getLogger(__name__)

TIME_WINDOW_SIZE = 5.0


def identity(x):
    return x


@dataclass
class TimeSource:
    source_id: int
    reference: int
    points: list[tuple[float, float]] = field(default_factory=list)

    _forward = identity

    def fit(self):
        arr = numpy.array(self.points)
        coeff = numpy.polyfit(arr[:, 0], arr[:, 1], deg=1)
        self._forward = lambda x: coeff[0] * x + coeff[1]
        log.debug(
            "Fit time source %s to base source with mapping %.20fx + %.1f",
            self.source_id,
            coeff[0],
            coeff[1],
        )


def get_seconds(time: Time):
    return time.seconds + time.nanoseconds * 1e-9


async def process_binary(session, filename):
    """
    Imports a binary OpenBikeSensor recording file [1] and returns a dataframe and
    metadata for the file as a tuple. The dataframe has these named columns:

      - datetime (timezone-aware UTC)
      - latitude (degrees east)
      - longitude (degrees north)
      - distance_overtaker (meters)
      - distance_stationary (meters)
      - confirmed (boolean)
      - course (degrees CCW from east, optional)
      - speed (meters per second, optional)

    [1]: https://github.com/openbikesensor/proto.git
    """
    df = []
    metadata = {}  # TODO

    with open(filename, "rb") as f:
        binary_data = f.read()
    chunks = filter(len, map(cobs.decode, binary_data.split(b"\x00")))
    events = list(map(parse_event, chunks))

    log.info("Parsed %s raw events from binary recording.", len(events))

    # Step 0: choose a source-of-truth time source
    best_time_source = None
    all_time_sources = {}

    for event in events:
        for time in event.time:
            if time.source_id not in all_time_sources:
                all_time_sources[time.source_id] = TimeSource(
                    time.source_id, time.reference
                )

            if (
                # prefer a time if we don't have one yet
                best_time_source is None
                # of it is is UNIX and the previous best one isn't
                or (
                    time.reference == Time.UNIX
                    and best_time_source.reference != Time.UNIX
                )
                # of it has a lower source_id
                or time.source_id < best_time_source.source_id
            ):
                best_time_source = time

    if best_time_source is None:
        raise ValueError("No suitable time source found.")

    if best_time_source.reference != Time.UNIX:
        raise ValueError(
            "No UNIX time source found in the recording, we don't support that yet."
        )

    log.debug(
        "Choose time source %s (type %s) as source of truth.",
        best_time_source.source_id,
        best_time_source.reference,
    )

    # Step 1: Put all events on the reference time axis, preferably UNIX time
    for event in events:
        # Find the reference time for this event
        reference_time = None
        for time in event.time:
            if time.source_id == best_time_source.source_id:
                reference_time = time
                break
        else:
            continue

        for time in event.time:
            if time.source_id != best_time_source.source_id:
                all_time_sources[time.source_id].points.append(
                    (get_seconds(time), get_seconds(reference_time))
                )

    for time_source in all_time_sources.values():
        if time_source.source_id != best_time_source.source_id:
            time_source.fit()

    event_times = []
    for i, event in enumerate(events):
        if not event.time:
            raise ValueError("Event at index %s has no time information" % i)
        base_time = [t for t in event.time if t.source_id == best_time_source.source_id]
        if base_time:
            event_times.append(get_seconds(base_time[0]))
        else:
            time = event.time[0]
            event_times.append(
                all_time_sources[time.source_id]._forward(get_seconds(time))
            )

    # Step 2: Extract timed information
    geolocations = []
    distances_overtaker = []
    distances_stationary = []
    confirmed = []

    for t, event in zip(event_times, events):
        if event.HasField("distance_measurement"):
            d = event.distance_measurement
            if d.source_id == 1:
                distances_overtaker.append((t, d.distance))
            else:
                distances_stationary.append((t, d.distance))

        if event.HasField("geolocation"):
            g = event.geolocation
            if g.latitude or g.longitude:
                geolocations.append((t, g.longitude, g.latitude))

        if event.HasField("user_input"):
            confirmed.append(t)

    confirmed = sorted(confirmed)

    # Step 3: Separate track into segments of contigous location information
    # suitable for interpolation
    segments = list(apply_split(split_by_distance(geolocations)))

    # Remove short segments
    segments = [numpy.array(t) for t in segments if len(t) >= 10]

    dfs = []

    for track in segments:
        tmin = track[0][0]
        tmax = track[-1][0]

        prev = None

        df = pandas.DataFrame(track, columns=("time", "longitude", "latitude"))
        df.insert(3, "distance_overtaker", numpy.nan)
        df.insert(4, "distance_stationary", numpy.nan)
        df.insert(5, "confirmed", False)

        for t in confirmed:
            if t < tmin or t > tmax:
                continue

            # find the track points before and after to interpolate,
            # or an exactly matching track point
            i = numpy.searchsorted(df["time"], t, side="right")
            if df["time"][i] != t and i != 0:
                df.loc[i - 0.5] = [
                    t,
                    *interpolate_location(df.loc[i - 1], df.loc[i], t),
                    numpy.nan,
                    numpy.nan,
                    True,
                ]
                df = df.sort_index().reset_index(drop=True)
                i += 1

            fn = partial(filter_window, t=t, prev=prev)
            distances_overtaker_window = sorted(filter(fn, distances_overtaker))
            distances_stationary_window = sorted(filter(fn, distances_stationary))

            distance_overtaker = min(d[1] for d in distances_overtaker_window)
            distance_stationary = min(d[1] for d in distances_stationary_window)

            df.loc[i, "distance_overtaker"] = distance_overtaker
            df.loc[i, "distance_stationary"] = distance_stationary
            df.loc[i, "confirmed"] = True

            prev = t

        coordinates = df[["longitude", "latitude"]].to_numpy()
        snapped = numpy.array(await snap_to_roads(session, coordinates))

        (
            df["longitude_snapped"],
            df["latitude_snapped"],
            df["way_id"],
            df["direction_reversed"],
        ) = snapped

        df["datetime"] = pandas.to_datetime(
            df["time"], origin="unix", unit="s", utc=True
        )
        df["course"] = compute_course(snapped.T)
        df["speed"] = 0  # TODO

        dfs.append(df)

    return pandas.concat(dfs), metadata


def compute_course(coordinates):
    g = pyproj.Geod(ellps="WGS84")
    print(
        coordinates[1:, 0].shape,
        coordinates[1:, 1].shape,
        coordinates[:-1, 0].shape,
        coordinates[:-1, 1].shape,
    )
    azimuth, _, _ = g.inv(
        coordinates[:-1, 0],
        coordinates[:-1, 1],
        coordinates[1:, 0],
        coordinates[1:, 1],
    )
    result = azimuth / 180 * numpy.pi
    # repeat the last result
    return numpy.append(result, result[0])


def filter_window(x, t, prev):
    return (
        # before or equal to button press
        x[0] <= t
        and
        # at most TIME_WINDOW_SIZE before button press
        x[0] >= t - TIME_WINDOW_SIZE
        and
        # not before or during previous button press
        not (prev is not None and x[0] <= prev)
    )


def get_window_distance(x, t, prev):
    return (
        # before or equal to button press
        x[0] <= t
        and
        # at most TIME_WINDOW_SIZE before button press
        x[0] >= t - TIME_WINDOW_SIZE
        and
        # not before or during previous button press
        not (prev is not None and x[0] <= prev)
    )


def unlerp(a, b, x):
    return (x - a) / (b - a)


def lerp(a, b, x):
    return a + (b - a) * x


def interpolate_location(a, b, x):
    f = unlerp(a["time"], b["time"], x)

    # Make sure we don't extrapolate.
    assert 0 <= f <= 1

    # Let's linearly interpolate, as this interpolation is *very* local. We can
    # assume a flat rectangular coordinate space, we don't need the accuracy of
    # spherical interpolation.
    return lerp(a["longitude"], b["longitude"], f), lerp(
        a["latitude"], b["latitude"], f
    )


def apply_split(it):
    arr = []
    for i in it:
        if i is None:
            yield arr
            arr = []
        else:
            arr.append(i)

    if arr:
        yield arr


def split_by_distance(geolocations, max_time=10, max_distance=100):
    it = iter(geolocations)
    try:
        prev = next(it)
    except StopIteration:
        return

    for current in it:
        t, lat, lng = current
        t0, lat0, lng0 = prev

        distance = haversine((lat0, lng0), (lat, lng), unit=Unit.METERS)
        time = t - t0

        split = distance > max_distance or time > max_time
        if split:
            yield None

        yield current
        prev = current
