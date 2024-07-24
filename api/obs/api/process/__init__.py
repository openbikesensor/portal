from functools import partial
import logging
import os
import json
import asyncio
import hashlib
import struct
import pytz
from os.path import join
from datetime import datetime

import numpy
from shapely import Point
from shapely.wkb import dumps as dump_wkb
from sqlalchemy import delete, func, select, and_
from sqlalchemy.orm import joinedload
from haversine import Unit, haversine_vector
from geopy import distance

from .snapping import snap_to_roads, wsg84_to_mercator
from .obs_csv import import_csv

from obs.api.db import OvertakingEvent, RoadUsage, Track, UserDevice, make_session
from obs.api.app import app

log = logging.getLogger(__name__)


async def process_tracks_loop(delay):
    while True:
        try:
            async with make_session() as session:
                track = (
                    await session.execute(
                        select(Track)
                        .where(Track.processing_status == "queued")
                        .order_by(Track.processing_queued_at)
                        .with_for_update(of=Track)
                        .options(joinedload(Track.author))
                    )
                ).scalar()

                if track is None:
                    await asyncio.sleep(delay)
                    continue

                await process_track(session, track)
        except Exception:
            log.exception("Failed to process track. Will continue.")
            await asyncio.sleep(1)
            continue


async def process_tracks(tracks):
    """
    Processes the tracks and writes event data to the database.

    :param tracks: A list of strings which
    """
    async with make_session() as session:
        for track_id_or_slug in tracks:
            track = (
                await session.execute(
                    select(Track)
                    .where(
                        Track.id == track_id_or_slug
                        if isinstance(track_id_or_slug, int)
                        else Track.slug == track_id_or_slug
                    )
                    .options(joinedload(Track.author))
                )
            ).scalar()

            if not track:
                raise ValueError(f"Track {track_id_or_slug!r} not found.")

            await process_track(session, track)


def to_naive_utc(t):
    if t is None:
        return None
    return t.astimezone(pytz.UTC).replace(tzinfo=None)


async def export_gpx(df, filename, name):
    import xml.etree.ElementTree as ET

    gpx = ET.Element("gpx")
    metadata = ET.SubElement(gpx, "metadata")
    ET.SubElement(metadata, "name").text = name

    trk = ET.SubElement(gpx, "trk")

    ET.SubElement(trk, "name").text = name
    ET.SubElement(trk, "type").text = "Cycling"

    trkseg = ET.SubElement(trk, "trkseg")

    for _, point in df.iterrows():
        trkpt = ET.SubElement(
            trkseg, "trkpt", lat=str(point["latitude"]), lon=str(point["longitude"])
        )
        ET.SubElement(trkpt, "time").text = point["datetime"].isoformat()

    et = ET.ElementTree(gpx)
    et.write(filename, encoding="utf-8", xml_declaration=True)


async def process_track(session, track):
    try:
        track.processing_status = "complete"
        track.processed_at = datetime.utcnow()
        await session.commit()

        original_file_path = track.get_original_file_path(app.config)

        output_dir = join(
            app.config.PROCESSING_OUTPUT_DIR, track.author.username, track.slug
        )
        os.makedirs(output_dir, exist_ok=True)

        (
            df,
            event_rows,
            track_metadata,
            events,
            track_json,
            track_raw_json,
        ) = await process_track_file(session, original_file_path)

        for output_filename, data in [
            ("events.json", events),
            ("track.json", track_json),
            ("trackRaw.json", track_raw_json),
        ]:
            target = join(output_dir, output_filename)
            log.debug("Writing file %s", target)
            with open(target, "wt", encoding="utf-8") as fp:
                json.dump(data, fp, indent=4)

        await export_gpx(df, join(output_dir, "track.gpx"), track.slug)

        log.info("Clear old track data...")
        await clear_track_data(session, track)
        await session.commit()

        device_identifier = track_metadata.get("DeviceId")
        if device_identifier:
            if isinstance(device_identifier, list):
                device_identifier = device_identifier[0]

            user_device = (
                await session.execute(
                    select(UserDevice).where(
                        and_(
                            UserDevice.user_id == track.author_id,
                            UserDevice.identifier == device_identifier,
                        )
                    )
                )
            ).scalar()

            if not user_device:
                user_device = UserDevice(
                    user_id=track.author_id, identifier=device_identifier
                )
                log.info("Create new device %s for this user", device_identifier)
                session.add(user_device)

            track.user_device = user_device
        else:
            log.info("No DeviceId in track metadata.")

        log.info("Import events into database...")
        await import_overtaking_events(session, track, event_rows)

        log.info("Import road usages...")
        await import_road_usages(session, track, df)

        # compute distance from previous point
        coordinates = numpy.dstack((df["latitude"], df["longitude"]))[0].tolist()

        df["distance"] = numpy.concatenate(
            (
                [numpy.nan],
                haversine_vector(coordinates[:-1], coordinates[1:], unit=Unit.METERS),
            )
        )

        log.info("Write track statistics and update status...")
        # statistics = compute_statistics(df)
        track.recorded_at = to_naive_utc(numpy.nanmin(df["datetime"]))
        track.recorded_until = to_naive_utc(numpy.nanmax(df["datetime"]))
        track.duration = (track.recorded_until - track.recorded_at).total_seconds()
        track.length = numpy.nansum(df["distance"])
        track.segments = 1  # we don't do splitting yet
        track.num_events = len(event_rows)
        track.num_measurements = len(event_rows)  # not distinguished anymore
        track.num_valid = len(event_rows)  # not distinguished anymore
        track.processing_status = "complete"
        track.processed_at = datetime.utcnow()
        track.geometry = func.ST_Transform(
            func.ST_GeomFromGeoJSON(json.dumps(track_raw_json["geometry"])),
            3857,
        )
        await session.commit()

        log.info("Track %s imported.", track.slug)
    except BaseException as e:
        await clear_track_data(session, track)
        track.processing_status = "error"
        track.processing_log = str(e)
        track.processed_at = datetime.utcnow()

        await session.commit()
        raise


def fix_nan(v):
    if numpy.isnan(v):
        return None
    return v


async def process_track_file(session, track_file):
    log.info("Load CSV file at %s", track_file)
    df, track_metadata = import_csv(track_file)

    # Snap track to roads from the database, adding latitude_snapped and longitude_snapped
    df = await snap_to_roads(session, df)

    # remove entries with missing data
    event_rows = df[df["confirmed"] & ~numpy.isnan(df["distance_overtaker"])]

    events = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [row["longitude"], row["latitude"]],
                },
                "properties": {
                    "time": row["datetime"].replace(tzinfo=None).isoformat(),
                    "distance_overtaker": fix_nan(row["distance_overtaker"]),
                    "distance_stationary": fix_nan(row["distance_stationary"]),
                    "course": fix_nan(row["course"]),
                    "speed": fix_nan(row["speed"]),
                    "direction_reversed": row.get("direction_reversed", 0) < 0,
                },
            }
            for _, row in event_rows.iterrows()
        ],
    }

    track_json = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": numpy.dstack(
                (df["longitude_snapped"], df["latitude_snapped"])
            )[0].tolist(),
        },
    }

    track_raw_json = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": numpy.dstack((df["longitude"], df["latitude"]))[0].tolist(),
        },
    }

    return df, event_rows, track_metadata, events, track_json, track_raw_json


async def clear_track_data(session, track):
    track.recorded_at = None
    track.recorded_until = None
    track.duration = None
    track.length = None
    track.segments = None
    track.num_events = None
    track.num_measurements = None
    track.num_valid = None

    await session.execute(
        delete(OvertakingEvent).where(OvertakingEvent.track_id == track.id)
    )
    await session.execute(delete(RoadUsage).where(RoadUsage.track_id == track.id))


async def import_overtaking_events(session, track, event_rows):
    # We use a dictionary to prevent per-track hash collisions, ignoring all
    # but the first event of the same hash
    event_models = {}

    for _, row in event_rows.iterrows():
        hex_hash = hashlib.sha256(
            struct.pack(
                "ddQ",
                row["latitude"],
                row["longitude"],
                int(row["datetime"].timestamp()),
            )
        ).hexdigest()

        event_models[hex_hash] = OvertakingEvent(
            track_id=track.id,
            hex_hash=hex_hash,
            way_id=row["way_id"],
            direction_reversed=row["direction_reversed"],
            geometry=func.ST_GeomFromWKB(
                dump_wkb(wsg84_to_mercator(Point(row["longitude"], row["latitude"])))
            ),
            latitude=row["latitude"],
            longitude=row["longitude"],
            time=row["datetime"].astimezone(pytz.utc).replace(tzinfo=None),
            distance_overtaker=row["distance_overtaker"],
            distance_stationary=row["distance_stationary"],
            course=row["course"],
            speed=row["speed"],
        )

    session.add_all(event_models.values())


def get_road_usage_segments(df):
    way_ids = set(df["way_id"]) - {0}

    for way_id in way_ids:
        rows = df[df["way_id"] == way_id]
        prev_row = None

        current_segment = []

        for i, (_, row) in enumerate(rows.iterrows()):
            current_segment.append(row)

            if prev_row is None:
                prev_row = row
                continue

            time_delta = (row["datetime"] - prev_row["datetime"]).total_seconds()
            p0 = wsg84_to_mercator(
                Point(prev_row["longitude_snapped"], prev_row["latitude_snapped"])
            )
            p1 = wsg84_to_mercator(
                Point(row["longitude_snapped"], row["latitude_snapped"])
            )
            distance = p0.distance(p1)

            if i == len(rows) - 1 or distance > 50 or time_delta > 30:
                yield (way_id, current_segment)
                current_segment = []

            prev_row = row


async def import_road_usages(session, track, df):
    usages = {}
    for way_id, rows in get_road_usage_segments(df):
        direction_reversed = numpy.mean(df["direction_reversed"]) > 0.5
        start_time = rows[0]["datetime"]
        end_time = rows[-1]["datetime"]
        time = start_time + (end_time - start_time) / 2

        hex_hash = hashlib.sha256(
            struct.pack("dQ", way_id, int(time.timestamp()))
        ).hexdigest()

        usages[hex_hash] = RoadUsage(
            track_id=track.id,
            hex_hash=hex_hash,
            way_id=way_id,
            time=time.astimezone(pytz.utc).replace(tzinfo=None),
            direction_reversed=direction_reversed,
        )
    session.add_all(usages.values())
