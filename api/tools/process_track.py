#!/usr/bin/env python3
import argparse
import logging
import os
import tempfile
import json
import shutil
import asyncio
import hashlib
import struct
import pytz

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
from obs.face.osm import DataSource, DatabaseTileSource, OverpassTileSource
from sqlalchemy import delete

from obs.face.db import make_session, connect_db, OvertakingEvent, async_session

log = logging.getLogger(__name__)


async def main():
    logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(message)s")

    parser = argparse.ArgumentParser(
        description="processes a single track for use in the portal, "
        "using the obs.face algorithms"
    )

    parser.add_argument(
        "-i", "--input", required=True, action="store", help="path to input CSV file"
    )
    parser.add_argument(
        "-o", "--output", required=True, action="store", help="path to output directory"
    )
    parser.add_argument(
        "--path-cache",
        action="store",
        default=None,
        dest="cache_dir",
        help="path where the visualization data will be stored",
    )
    parser.add_argument(
        "--settings",
        dest="settings_file",
        required=True,
        default=None,
        help="path to track settings file",
    )

    # https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING
    postgres_url_default = os.environ.get("POSTGRES_URL")
    parser.add_argument(
        "--postgres-url",
        required=not postgres_url_default,
        action="store",
        help="connection string for postgres database",
        default=postgres_url_default,
    )

    args = parser.parse_args()

    async with connect_db(args.postgres_url):
        if args.cache_dir is None:
            with tempfile.TemporaryDirectory() as cache_dir:
                args.cache_dir = cache_dir
                await process(args)
        else:
            await process(args)


async def process(args):
    log.info("Loading OpenStreetMap data")
    tile_source = DatabaseTileSource(async_session.get())
    # tile_source = OverpassTileSource(args.cache_dir)
    data_source = DataSource(tile_source)

    filename_input = os.path.abspath(args.input)
    dataset_id = os.path.splitext(os.path.basename(args.input))[0]

    os.makedirs(args.output, exist_ok=True)

    log.info("Loading settings")
    settings_path = os.path.abspath(args.settings_file)
    with open(settings_path, "rt") as f:
        settings = json.load(f)

    settings_output_path = os.path.abspath(
        os.path.join(args.output, "track-settings.json")
    )
    if settings_path != settings_output_path:
        log.info("Copy settings to output directory")
        shutil.copyfile(settings_path, settings_output_path)

    log.info("Annotating and filtering CSV file")
    imported_data, statistics = ImportMeasurementsCsv().read(
        filename_input,
        user_id="dummy",
        dataset_id=dataset_id,
    )

    input_data = await AnnotateMeasurements(
        data_source, cache_dir=args.cache_dir
    ).annotate(imported_data)

    filters_from_settings = []
    for filter_description in settings.get("filters", []):
        filter_type = filter_description.get("type")
        if filter_type == "PrivacyZonesFilter":
            privacy_zones = [
                PrivacyZone(
                    latitude=zone.get("latitude"),
                    longitude=zone.get("longitude"),
                    radius=zone.get("radius"),
                )
                for zone in filter_description.get("config", {}).get("privacyZones", [])
            ]
            filters_from_settings.append(PrivacyZonesFilter(privacy_zones))
        else:
            log.warning("Ignoring unknown filter type %r in settings file", filter_type)

    track_filter = ChainFilter(
        RequiredFieldsFilter(),
        PrivacyFilter(
            user_id_mode=AnonymizationMode.REMOVE,
            measurement_id_mode=AnonymizationMode.REMOVE,
        ),
        *filters_from_settings,
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

    statistics_json = {
        "recordedAt": statistics["t_min"].isoformat()
        if statistics["t_min"] is not None
        else None,
        "recordedUntil": statistics["t_max"].isoformat()
        if statistics["t_max"] is not None
        else None,
        "duration": statistics["t"],
        "length": statistics["d"],
        "segments": statistics["n_segments"],
        "numEvents": statistics["n_confirmed"],
        "numMeasurements": statistics["n_measurements"],
        "numValid": statistics["n_valid"],
    }

    for output_filename, data in [
        ("measurements.json", measurements_json),
        ("overtakingEvents.json", overtaking_events_json),
        ("track.json", track_json),
        ("statistics.json", statistics_json),
    ]:
        with open(os.path.join(args.output, output_filename), "w") as fp:
            json.dump(data, fp, indent=4)

    log.info("Importing to database.")
    async with make_session() as session:
        await clear_track_data(session, settings["trackId"])
        await import_overtaking_events(session, settings["trackId"], overtaking_events)
        await session.commit()


async def clear_track_data(session, track_id):
    await session.execute(
        delete(OvertakingEvent).where(OvertakingEvent.track_id == track_id)
    )


async def import_overtaking_events(session, track_id, overtaking_events):
    event_models = []
    for m in overtaking_events:
        sha = hashlib.sha256()
        sha.update(track_id.encode("utf-8"))
        sha.update(struct.pack("Q", int(m["time"].timestamp())))
        hex_hash = sha.hexdigest()

        event_models.append(
            OvertakingEvent(
                track_id=track_id,
                hex_hash=hex_hash,
                way_id=m["OSM_way_id"],
                direction_reversed=m["OSM_way_orientation"] < 0,
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


if __name__ == "__main__":
    asyncio.run(main())
