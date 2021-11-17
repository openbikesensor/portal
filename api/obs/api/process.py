import logging
import os
import json
import asyncio
import hashlib
import struct
import pytz
from os.path import join
from datetime import datetime

from sqlalchemy import delete, select
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

from obs.api.db import OvertakingEvent, Track, make_session
from obs.api.app import app

log = logging.getLogger(__name__)


async def process_tracks_loop(data_source, delay):
    while True:
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

            try:
                await process_track(session, track, data_source)
            except:
                log.exception("Failed to process track %s. Will continue.", track.slug)
                await asyncio.sleep(1)
                continue


async def process_tracks(data_source, tracks):
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

            await process_track(session, track, data_source)


def to_naive_utc(t):
    if t is None:
        return None
    return t.astimezone(pytz.UTC).replace(tzinfo=None)


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
        imported_data, statistics = ImportMeasurementsCsv().read(
            original_file_path,
            user_id="dummy",  # TODO: user username or id or nothing?
            dataset_id=Track.slug,  # TODO: use track id or slug or nothing?
        )

        annotator = AnnotateMeasurements(
            data_source, cache_dir=app.config.OBS_FACE_CACHE_DIR
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
                "coordinates": [[m["latitude"], m["longitude"]] for m in track_points],
            },
        }

        for output_filename, data in [
            ("measurements.json", measurements_json),
            ("overtakingEvents.json", overtaking_events_json),
            ("track.json", track_json),
        ]:
            target = join(output_dir, output_filename)
            log.debug("Writing file %s", target)
            with open(target, "w") as fp:
                json.dump(data, fp, indent=4)

        log.info("Import events into database...")
        await clear_track_data(session, track)
        await import_overtaking_events(session, track, overtaking_events)

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


async def import_overtaking_events(session, track, overtaking_events):
    event_models = []
    for m in overtaking_events:
        hex_hash = hashlib.sha256(
            struct.pack("QQ", track.id, int(m["time"].timestamp()))
        ).hexdigest()

        event_models.append(
            OvertakingEvent(
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
        )

    session.add_all(event_models)
