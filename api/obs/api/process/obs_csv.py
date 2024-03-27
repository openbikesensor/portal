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

import datetime
import gzip
import logging
import math
import re
import urllib.parse
import pandas
import numpy

import gpstime
import pytz

from .snapping import snap_to_roads

log = logging.getLogger(__name__)


# A magic number. When using timestamps as an intermediate format, we have to
# subtract this, because GPS time timestamps' epoch start at some point in
# the 80's ;)
GPS_UNIX_EPOCH_OFFSET = 315964800

# A date before which no OBS existed, so any timestamp before this date can be
# assumed invalid data.
REJECT_MEASUREMENTS_BEFORE = datetime.datetime(2018, 1, 1, tzinfo=datetime.timezone.utc)


def convert_gps_to_utc(dt):
    return datetime.datetime.fromtimestamp(
        gpstime.gps2unix(dt.timestamp() - GPS_UNIX_EPOCH_OFFSET), tz=pytz.UTC
    )


async def process_csv(session, filename):
    df, track_metadata = import_csv(filename)

    # Snap track to roads from the database, adding latitude_snapped and longitude_snapped
    coordinates = numpy.stack((df["longitude"], df["latitude"])).T
    snap_info = await snap_to_roads(session, coordinates)
    (
        df["longitude_snapped"],
        df["latitude_snapped"],
        df["way_id"],
        df["direction_reversed"],
    ) = snap_info

    return df, track_metadata


def import_csv(filename):
    """
    Imports a CSV file in OpenBikeSensor format [1] and returns a dataframe and
    metadata for the file as a tuple. The dataframe has these named columns:

      - datetime (timezone-aware UTC)
      - latitude (degrees east)
      - longitude (degrees north)
      - distance_overtaker (meters)
      - distance_stationary (meters)
      - confirmed (boolean)
      - course (degrees CCW from east, optional)
      - speed (meters per second, optional)

    The file will already be filtered, no invalid rows will be present and
    private entries ("InsidePrivacyArea") will be removed.

    [1]: https://github.com/openbikesensor/OpenBikeSensorFirmware/blob/main/docs/software/firmware/csv_format.md
    """
    df, metadata = _read_csv(filename)
    _correct_gps_time(df, metadata)

    # TODO: derive velocity

    return df, metadata


IMPORTED_COLUMNS = (
    "Date",
    "Time",
    "Latitude",
    "Longitude",
    "Course",
    "Speed",
    "Left",
    "Right",
    "Confirmed",
    "Lid",
    "Case",
    "InsidePrivacyArea",
    "insidePrivacyArea",
)

# 1.0: Date;Time;Latitude;Longitude;Lid;Case;Confirmed
# 1.1: Date;Time;Latitude;Longitude;Course;Speed;Lid;Case;Confirmed
# 1.2: Date;Time;Latitude;Longitude;Course;Speed;Right;Left;Confirmed
# 1.3: Date;Time;Latitude;Longitude;Course;Speed;Right;Left;Confirmed;insidePrivacyArea
# 2.0: Date;Time;Millis;Comment;Latitude;Longitude;Altitude;Course;Speed;HDOP;Satellites;BatteryLevel;Left;Right;Confirmed;Marked;Invalid;
#      InsidePrivacyArea;Factor;Measurements;Tms1;Lus1;Rus1;Tms2;Lus2;Rus2...;Tms30;Lus30;Rus30


def _read_csv(filename):
    try:
        opener = gzip.open if filename.endswith(".gz") else open

        with opener(filename, "rt", encoding="utf-8") as file:
            # Try to parse the first line as metadata. If that doens't work,
            # prepend the
            header_line: str = next(iter(file))
            metadata = {}

            if "OBSDataFormat" in header_line:
                try:
                    metadata = dict(
                        urllib.parse.parse_qsl(header_line, strict_parsing=True)
                    )
                except ValueError:
                    pass

            if not metadata:
                # No metadata found, so this must be an old version. Let's go back to
                # the start of the file again.
                file.seek(0)

            # Identify format based on first line and metadata, if the parsing worked
            format_id = identify_format(header_line, metadata)
            log.debug("File identified as format version %s", format_id)

            # Let pandas do the heavy lifting :)
            df = pandas.read_csv(
                file,
                sep=";",
                usecols=lambda x: x in IMPORTED_COLUMNS,
            )

        log.debug("Read %s rows of CSV data", len(df))

        # Rename old column names from 1.0 or 1.1 formats
        df = df.rename(
            columns={
                "Lid": "distance_stationary",
                "Case": "distance_overtaker",
                "Left": "distance_overtaker",
                "Right": "distance_stationary",
                "insidePrivacyArea": "privacy",
                "InsidePrivacyArea": "privacy",
                "Confirmed": "confirmed",
                "Latitude": "latitude",
                "Longitude": "longitude",
                "Course": "course",
                "Speed": "speed",
            }
        )

        # Parse the date and time together as a UTC timestamp (GPS is corrected later)
        df["datetime"] = pandas.to_datetime(
            df["Date"] + " " + df["Time"],
            utc=True,
            format="%d.%m.%Y %H:%M:%S",
            errors="coerce",
        )

        # Remove all data that we didn't need
        df = df.drop(
            columns=set(df.columns)
            - {
                "datetime",
                "distance_overtaker",
                "distance_stationary",
                "privacy",
                "confirmed",
                "latitude",
                "longitude",
                "course",
                "speed",
            }
        )

        if len(df) < 3:
            raise ValueError("Can't process track with so few points.")

        # Remove rows that are useless
        df = df[
            (df["datetime"] != pandas.NaT)
            & (df["datetime"] > REJECT_MEASUREMENTS_BEFORE)
            & ~numpy.isnan(df["latitude"])
            & ~numpy.isnan(df["longitude"])
            & df["latitude"].astype(numpy.bool_)
            & df["longitude"].astype(numpy.bool_)
        ]

        for key in ("distance_stationary", "distance_overtaker"):
            df[key] = numpy.where(
                (df[key] == 255) | (df[key] == 999), numpy.nan, df[key]
            )
            df[key] = df[key] * 0.01  # convert cm to m

        if "speed" in df:
            df["speed"] = df["speed"] / 3.6  # convert km/h to m/s

        if "course" in df:
            df["course"] = (
                math.pi / 180.0 * (90.0 - df["course"].astype(numpy.float64))
            ) % (
                2 * math.pi
            )  # convert to radians

        df["confirmed"] = df["confirmed"].astype(numpy.bool_)

        if "privacy" in df:
            df = df[~df["privacy"].astype(numpy.bool_)]
            df = df.drop(columns="privacy")

        log.debug("Kept %s rows of CSV data", len(df))

        return df, metadata

    except Exception as e:
        log.exception("Error while reading track file")
        raise ValueError(f"Error while reading track file: {e}") from e


def identify_format(header, metadata):
    """
    Tries to figure out the format version from the header row or metadata row,
    depending on what's available.
    """
    try:
        return metadata["OBSDataFormat"]
    except Exception:
        pass

    # this is a pre-v2 version
    if "Left" in header and "Right" in header:
        return "1.3" if "insidePrivacyArea" in header else "1.2"

    if "Case" in header and "Lid" in header:
        return "1.1" if "Course" in header and "Speed" in header else "1.0"

    raise ValueError("unknown file format")


def _correct_gps_time(df, metadata):
    try:
        timezone = metadata["TimeZone"]
    except:
        return

    if timezone != "GPS":
        return

    df["datetime"] = df["datetime"].map(convert_gps_to_utc)
