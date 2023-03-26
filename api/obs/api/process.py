import logging
import os
import json
import asyncio
import hashlib
import struct
import pytz
from os.path import join
from datetime import datetime

from sqlalchemy import delete, select, and_
from sqlalchemy.orm import joinedload

from obs.face.importer import ImportMeasurementsCsv
from obs.face.geojson import ExportMeasurements
from obs.face.annotate import AnnotateMeasurements
from obs.face.filter import (
    AnonymizationMode,
    ChainFilter,
    ConfirmedFilter,
    DistanceMeasuredFilter,
    PrivacyFilter,
    PrivacyZone,
    PrivacyZonesFilter,
    RequiredFieldsFilter,
)

from obs.face.osm import DataSource, DatabaseTileSource

from obs.api.db import OvertakingEvent, RoadUsage, Track, UserDevice, make_session
from obs.api.app import app

log = logging.getLogger(__name__)


def get_data_source():
    """
    Creates a data source based on the configuration of the portal. In *lean*
    mode, the OverpassTileSource is used to fetch data on demand. In normal
    mode, the roads database is used.
    """
    return DataSource(DatabaseTileSource())


async def process_tracks_loop(delay):
    while True:
        try:
            async with make_session() as session:
                track = (
                    await session.execute(
                        select(Track)
                        .where(Track.processing_status == "queued")
                        .order_by(Track.processing_queued_at)
                        .options(joinedload(Track.author))
                    )
                ).scalar()

                if track is None:
                    await asyncio.sleep(delay)
                    continue

                data_source = get_data_source()
                await process_track(session, track, data_source)
        except BaseException:
            log.exception("Failed to process track. Will continue.")
            await asyncio.sleep(1)
            continue


async def process_tracks(tracks):
    """
    Processes the tracks and writes event data to the database.

    :param tracks: A list of strings which
    """
    data_source = get_data_source()

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

            await process_track(session, track, data_source)


def to_naive_utc(t):
    if t is None:
        return None
    return t.astimezone(pytz.UTC).replace(tzinfo=None)


async def export_gpx(track, filename, name):
    import xml.etree.ElementTree as ET

    gpx = ET.Element("gpx")
    metadata = ET.SubElement(gpx, "metadata")
    ET.SubElement(metadata, "name").text = name

    trk = ET.SubElement(gpx, "trk")

    ET.SubElement(trk, "name").text = name
    ET.SubElement(trk, "type").text = "Cycling"

    trkseg = ET.SubElement(trk, "trkseg")

    for point in track:
        trkpt = ET.SubElement(
            trkseg, "trkpt", lat=str(point["latitude"]), lon=str(point["longitude"])
        )
        ET.SubElement(trkpt, "time").text = point["time"].isoformat()

    et = ET.ElementTree(gpx)
    et.write(filename, encoding="utf-8", xml_declaration=True)


async def process_track(session, track, data_source):
    try:
        track.processing_status = "complete"
        track.processed_at = datetime.utcnow()
        await session.commit()

        original_file_path = track.get_original_file_path(app.config)

        output_dir = join(
            app.config.PROCESSING_OUTPUT_DIR, track.author.username, track.slug
        )
        os.makedirs(output_dir, exist_ok=True)

        log.info("Annotating and filtering CSV file")
        imported_data, statistics, track_metadata = ImportMeasurementsCsv().read(
            original_file_path,
            user_id="dummy",  # TODO: user username or id or nothing?
            dataset_id=Track.slug,  # TODO: use track id or slug or nothing?
            return_metadata=True,
        )

        annotator = AnnotateMeasurements(
            data_source,
            cache_dir=app.config.OBS_FACE_CACHE_DIR,
            fully_annotate_unconfirmed=True,
        )
        input_data = await annotator.annotate(imported_data)

        track_filter = ChainFilter(
            RequiredFieldsFilter(),
            PrivacyFilter(
                user_id_mode=AnonymizationMode.REMOVE,
                measurement_id_mode=AnonymizationMode.REMOVE,
            ),
            # TODO: load user privacy zones and create a PrivacyZonesFilter() from them
        )
        measurements_filter = DistanceMeasuredFilter()
        overtaking_events_filter = ConfirmedFilter()

        track_points = track_filter.filter(input_data, log=log)
        measurements = measurements_filter.filter(track_points, log=log)
        overtaking_events = overtaking_events_filter.filter(measurements, log=log)

        exporter = ExportMeasurements("measurements.dummy")
        await exporter.add_measurements(measurements)
        measurements_json = exporter.get_data()
        del exporter

        exporter = ExportMeasurements("overtaking_events.dummy")
        await exporter.add_measurements(overtaking_events)
        overtaking_events_json = exporter.get_data()
        del exporter

        track_json = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[m["longitude"], m["latitude"]] for m in track_points],
            },
        }

        track_raw_json = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [m["longitude_GPS"], m["latitude_GPS"]] for m in track_points
                ],
            },
        }

        for output_filename, data in [
            ("measurements.json", measurements_json),
            ("overtakingEvents.json", overtaking_events_json),
            ("track.json", track_json),
            ("trackRaw.json", track_raw_json),
        ]:
            target = join(output_dir, output_filename)
            log.debug("Writing file %s", target)
            with open(target, "w") as fp:
                json.dump(data, fp, indent=4)

        await export_gpx(track_points, join(output_dir, "track.gpx"), track.slug)

        log.info("Clearing old track data...")
        await clear_track_data(session, track)
        await session.commit()

        device_identifier = track_metadata.get("DeviceId")
        if device_identifier:
            if isinstance(device_identifier, list):
                device_identifier = device_identifier[0]

            log.info("Finding or creating device %s", device_identifier)
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

            log.debug("user_device is %s", user_device)

            if not user_device:
                user_device = UserDevice(
                    user_id=track.author_id, identifier=device_identifier
                )
                log.debug("Create new device for this user")
                session.add(user_device)

            track.user_device = user_device
        else:
            log.info("No DeviceId in track metadata.")

        log.info("Import events into database...")
        await import_overtaking_events(session, track, overtaking_events)

        log.info("import road usages...")
        await import_road_usages(session, track, track_points)

        log.info("Write track statistics and update status...")
        track.recorded_at = to_naive_utc(statistics["t_min"])
        track.recorded_until = to_naive_utc(statistics["t_max"])
        track.duration = statistics["t"]
        track.length = statistics["d"]
        track.segments = statistics["n_segments"]
        track.num_events = statistics["n_confirmed"]
        track.num_measurements = statistics["n_measurements"]
        track.num_valid = statistics["n_valid"]
        track.processing_status = "complete"
        track.processed_at = datetime.utcnow()
        await session.commit()

        log.info("Track %s imported.", track.slug)
    except BaseException as e:
        await clear_track_data(session, track)
        track.processing_status = "error"
        track.processing_log = str(e)
        track.processed_at = datetime.utcnow()

        await session.commit()
        raise


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


async def import_overtaking_events(session, track, overtaking_events):
    # We use a dictionary to prevent per-track hash collisions, ignoring all
    # but the first event of the same hash
    event_models = {}

    for m in overtaking_events:
        hex_hash = hashlib.sha256(
            struct.pack(
                "ddQ", m["latitude"], m["longitude"], int(m["time"].timestamp())
            )
        ).hexdigest()

        event_models[hex_hash] = OvertakingEvent(
            track_id=track.id,
            hex_hash=hex_hash,
            way_id=m.get("OSM_way_id"),
            direction_reversed=m.get("OSM_way_orientation", 0) < 0,
            geometry=json.dumps(
                {
                    "type": "Point",
                    "coordinates": [m["longitude"], m["latitude"]],
                }
            ),
            latitude=m["latitude"],
            longitude=m["longitude"],
            time=m["time"].astimezone(pytz.utc).replace(tzinfo=None),
            distance_overtaker=m["distance_overtaker"],
            distance_stationary=m["distance_stationary"],
            course=m["course"],
            speed=m["speed"],
        )

    session.add_all(event_models.values())


def get_road_usages(track_points):
    last_key = None
    last = None

    for p in track_points:
        way_id = p.get("OSM_way_id")
        direction_reversed = p.get("OSM_way_orientation", 0) < 0

        key = (way_id, direction_reversed)

        if last_key is None or last_key[0] is None:
            last = p
            last_key = key
            continue

        if last_key != key:
            if last_key[0] is not None:
                yield last
            last_key = key
            last = p

    if last is not None and last_key[0] is not None:
        yield last


async def import_road_usages(session, track, track_points):
    usages = set()
    for p in get_road_usages(track_points):
        direction_reversed = p.get("OSM_way_orientation", 0) < 0
        way_id = p.get("OSM_way_id")
        time = p["time"]

        hex_hash = hashlib.sha256(
            struct.pack("dQ", way_id, int(time.timestamp()))
        ).hexdigest()

        usages.add(
            RoadUsage(
                track_id=track.id,
                hex_hash=hex_hash,
                way_id=way_id,
                time=time.astimezone(pytz.utc).replace(tzinfo=None),
                direction_reversed=direction_reversed,
            )
        )
    session.add_all(usages)
