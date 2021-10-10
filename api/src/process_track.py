import argparse
import logging
import os
import tempfile
import json

from obs.face.importer import ImportMeasurementsCsv
from obs.face.annotate import AnnotateMeasurements
from obs.face.filter import (
    PrivacyFilter,
    ChainFilter,
    AnonymizationMode,
    RequiredFieldsFilter,
    ConfirmedFilter,
    PrivacyZone,
    PrivacyZonesFilter,
)
from obs.face.osm import DataSource as OSMDataSource

log = logging.getLogger(__name__)


def main():
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
        type=argparse.FileType("rt", encoding="utf-8"),
        default=None,
        help="path where the visualization data will be stored",
    )

    args = parser.parse_args()

    if args.cache_dir is None:
        with tempfile.TemporaryDirectory() as cache_dir:
            args.cache_dir = cache_dir
            process(args)
    else:
        process(args)


def process(args):
    log.info("Loading OpenStreetMap data")
    osm = OSMDataSource(cache_dir=args.cache_dir)

    filename_input = os.path.abspath(args.input)
    dataset_id = os.path.splitext(os.path.basename(args.input))[0]

    os.makedirs(args.output, exist_ok=True)

    log.info("Loading settings")
    settings = json.load(args.settings)

    log.info("Annotating and filtering CSV file")
    measurements, statistics = ImportMeasurementsCsv().read(
        filename_input,
        user_id="dummy",
        dataset_id=dataset_id,
    )

    measurements = AnnotateMeasurements(osm, cache_dir=args.cache_dir).annotate(
        measurements
    )

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

    input_filter = ChainFilter(
        RequiredFieldsFilter(),
        PrivacyFilter(
            user_id_mode=AnonymizationMode.REMOVE,
            measurement_id_mode=AnonymizationMode.REMOVE,
        ),
        *filters_from_settings,
    )
    confirmed_filter = ConfirmedFilter()

    valid_measurements = input_filter.filter(measurements, log=log)
    confirmed_measurements = confirmed_filter.filter(valid_measurements, log=log)

    # write out
    confirmed_measurements_json = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [m["latitude"], m["longitude"]],
                },
                "properties": {
                    "distanceOvertaker": m["distance_overtaker"],
                    "distanceStationary": m["distance_stationary"],
                    "confirmed": True,
                },
            }
            for m in confirmed_measurements
        ],
    }
    all_measurements_json = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [m["latitude"], m["longitude"]],
                },
                "properties": {
                    "distanceOvertaker": m["distance_overtaker"],
                    "distanceStationary": m["distance_stationary"],
                    "confirmed": m in confirmed_measurements,
                },
            }
            for m in valid_measurements
            if m["distance_overtaker"] or m["distance_stationary"]
        ],
    }

    track_json = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [m["latitude"], m["longitude"]] for m in valid_measurements
            ],
        },
    }

    statistics_json = {
        "recordedAt": statistics["t_min"].isoformat(),
        "recordedUntil": statistics["t_max"].isoformat(),
        "duration": statistics["t"],
        "length": statistics["d"],
        "segments": statistics["n_segments"],
        "numEvents": statistics["n_confirmed"],
        "numMeasurements": statistics["n_measurements"],
        "numValid": statistics["n_valid"],
    }

    for output_filename, data in [
        ("all_measurements.json", all_measurements_json),
        ("confirmed_measurements.json", confirmed_measurements_json),
        ("track.json", track_json),
        ("statistics.json", statistics_json),
    ]:
        with open(os.path.join(args.output, output_filename), "w") as fp:
            json.dump(data, fp, indent=4)


if __name__ == "__main__":
    main()
