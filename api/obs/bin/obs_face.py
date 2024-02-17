#!/usr/bin/python

# Copyright (C) 2020-2021 OpenBikeSensor Contributors
# Contact: https://openbikesensor.org
#
# This file is part of the OpenBikeSensor Scripts Collection.
#
# The OpenBikeSensor Scripts Collection is free software: you can redistribute it and/or
# modify it under the terms of the GNU Lesser General Public License as
# published by the Free Software Foundation, either version 3 of the License,
# or (at your option) any later version.
#
# The OpenBikeSensor Scripts Collection is distributed in the hope that it will be
# useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser
# General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public License
# along with the OpenBikeSensor Scripts Collection.  If not, see
# <http://www.gnu.org/licenses/>.

import argparse
import asyncio
import pathlib
from multiprocessing import Process, Queue
import logging
import os
import sys
import time

import jsons
import coloredlogs

from obs.face.importer import ImportMeasurementsCsv
from obs.face.annotate import AnnotateMeasurements
from obs.face.filter import RequiredFieldsFilter, ChainFilter, DistanceMeasuredFilter
from obs.face.geojson import ExportMeasurements, ExportRoadAnnotation
from obs.face.osm import DataSource, OverpassTileSource
from obs.face.filter import PrivacyFilter, AnonymizationMode

log = logging.getLogger(__name__)


def collect_datasets(path, exclusion_list):
    datasets = []
    path_absolute = os.path.abspath(path)

    for root, dirs, files in os.walk(path):
        unused, user_id = os.path.split(root)
        for filename in files:
            filename_no_extension, extension = os.path.splitext(filename)
            if extension == ".csv":
                filename_absolute = os.path.abspath(os.path.join(root, filename))
                filename_relative = os.path.relpath(
                    filename_absolute, start=path_absolute
                )

                # test against exclusion list
                keep = True
                for p in exclusion_list:
                    hit = filename_relative.startswith(p)
                    if hit:
                        keep = False
                        break

                if keep:
                    dataset = {
                        "format": "CSV",
                        "filename": filename_absolute,
                        "filename_relative": filename_relative,
                        "user_id": user_id,
                    }
                    datasets.append(dataset)
                    log.debug("adding %s", filename_relative)
                else:
                    log.debug("excluding %s", filename_relative)

    return datasets


def process_datasets(
    datasets,
    path_annotated,
    osm,
    skip_if_json_exists=True,
    path_cache="./cache",
    n_worker_processes=1,
    process_parallel=True,
    right_hand_traffic=True,
):

    log.info("annotating datasets")

    annotator = AnnotateMeasurements(osm, cache_dir=path_cache)
    measurement_filter = ChainFilter(
        RequiredFieldsFilter(),
        DistanceMeasuredFilter(),
    )

    importer = ImportMeasurementsCsv(right_hand_traffic=right_hand_traffic)

    input_queue = Queue()
    output_queue = Queue()

    n_in = len(datasets)
    for dataset in datasets:
        input_queue.put(dataset)

    # Create new processes
    if process_parallel:
        processes = [None] * n_worker_processes
    else:
        processes = []
        dummy_process = AnnotationProcess(
            0,
            input_queue,
            output_queue,
            importer,
            annotator,
            measurement_filter,
            path_annotated,
            skip_if_json_exists,
        )

    finished = False
    measurements = []
    statistics = {
        "n_files": 0,
        "n_measurements": 0,
        "n_valid": 0,
        "n_confirmed": 0,
        "t_min": None,
        "t_max": None,
        "t_total": 0,
        "n_segments": 0,
        "t": 0,
        "d": 0,
    }

    n_out = 0
    while not finished:
        # analyze
        n_alive = 0
        for p in processes:
            n_alive += (p is not None) and p.is_alive()

        finished = output_queue.empty() and input_queue.empty() and (n_out == n_in)

        try:
            input_queue_size = input_queue.qsize()
            output_queue_size = output_queue.qsize()
        except NotImplementedError:
            # on MacOS qsize() throws, so substitute the approximate queue size for the debug log
            input_queue_size = "N/A"
            output_queue_size = "N/A"

        log.debug(
            "datasets: total %s, input queue %s, output queue %s, "
            "finished %s (%s measurements); worker: running %s, total %s",
            n_in,
            input_queue_size,
            output_queue_size,
            n_out,
            len(measurements),
            n_alive,
            len(processes),
        )

        if process_parallel:
            # (re)spawn processes
            if not finished:
                for [process_id, p] in enumerate(processes):
                    if p is None or not p.is_alive():
                        q = AnnotationProcess(
                            process_id,
                            input_queue,
                            output_queue,
                            importer,
                            annotator,
                            measurement_filter,
                            path_annotated,
                            skip_if_json_exists,
                        )
                        q.start()
                        processes[process_id] = q
                time.sleep(1)
        elif not input_queue.empty():
            dummy_process.dequeue_and_process()

        # empty output queue
        while not output_queue.empty():
            dataset = output_queue.get()
            if dataset is not None:
                measurements += dataset["measurements"]
                statistics = combine_statistics(statistics, dataset["statistics"])
            n_out += 1

    for p in processes:
        if p is not None:
            p.join()

    if n_out != n_in:
        raise ValueError("parallel processing failed")

    return measurements, statistics


def combine_statistics(a, b):
    stats = {
        "n_files": a["n_files"] + b["n_files"],
        "n_measurements": a["n_measurements"] + b["n_measurements"],
        "n_valid": a["n_valid"] + b["n_valid"],
        "n_confirmed": a["n_confirmed"] + b["n_confirmed"],
        "t_min": a["t_min"]
        if a["t_min"] is not None and (b["t_min"] is None or a["t_min"] < b["t_min"])
        else b["t_min"],
        "t_max": a["t_max"]
        if a["t_max"] is not None and (b["t_max"] is None or a["t_max"] > b["t_max"])
        else b["t_max"],
        "t_total": a["t_total"] + b["t_total"],
        "n_segments": a["n_segments"] + b["n_segments"],
        "t": a["t"] + b["t"],
        "d": a["d"] + b["d"],
    }
    return stats


class PrefixLogFilter:
    def __init__(self, prefix):
        self.prefix = prefix

    def filter(self, record):
        record.msg = self.prefix + record.msg
        return True


class AnnotationProcess(Process):
    def __init__(
        self,
        process_id,
        job_queue,
        result_queue,
        importer,
        annotator,
        measurement_filter,
        path_annotated,
        skip_if_json_exists,
    ):
        Process.__init__(self, name=process_id)

        self.process_id = process_id
        self.job_queue = job_queue
        self.result_queue = result_queue
        self.importer = importer
        self.annotator = annotator
        self.measurement_filter = measurement_filter
        self.path_annotated = path_annotated
        self.process_name = "AnnotationProcess" + str(process_id)
        self.skip_if_json_exists = skip_if_json_exists

    def run(self):
        while not self.job_queue.empty():
            self.dequeue_and_process()

    def dequeue_and_process(self):
        dataset = self.job_queue.get()
        measurements = self.annotate(dataset)
        self.result_queue.put(measurements)

    def annotate(self, dataset):
        filename_json = os.path.join(
            self.path_annotated,
            os.path.splitext(dataset["filename_relative"])[0] + ".json",
        )

        log.debug("[%s] processing %s", self.process_name, filename_json)

        dataset_annotated = None
        do_annotate = True
        if self.skip_if_json_exists and os.path.isfile(filename_json):
            t1 = pathlib.Path(dataset["filename"]).stat().st_mtime
            t2 = pathlib.Path(filename_json).stat().st_mtime

            if t1 <= t2:
                log.debug(
                    "[%s] using cached result from %s ",
                    self.process_name,
                    filename_json,
                )
                with open(filename_json, "r") as infile:
                    dataset_annotated = jsons.loads(infile.read())
                do_annotate = False
            else:
                log.debug(
                    "[%s] cached result in %s is outdated, recomputing ",
                    self.process_name,
                    filename_json,
                )

        if do_annotate:
            filename_log = os.path.join(
                self.path_annotated,
                os.path.splitext(dataset["filename_relative"])[0] + ".log",
            )

            os.makedirs(os.path.dirname(filename_log), exist_ok=True)

            # Create a per-file logger
            file_log = logging.Logger(name=dataset["filename_relative"])
            file_log.addHandler(logging.FileHandler(filename_log, mode="w"))
            stream_handler = logging.StreamHandler(sys.stderr)
            stream_handler.setLevel(logging.WARNING)
            file_log.addHandler(stream_handler)
            file_log.addFilter(PrefixLogFilter(dataset["filename_relative"] + ": "))
            file_log.parent = log
            file_log.setLevel(logging.WARNING)

            try:
                measurements, statistics = self.importer.read(
                    dataset["filename"],
                    user_id=dataset["user_id"],
                    dataset_id=dataset["filename_relative"],
                    log=file_log,
                )
                measurements = self.annotator.annotate(measurements)

                measurements = self.measurement_filter.filter(
                    measurements, log=file_log
                )

                dataset_annotated = {
                    "measurements": measurements,
                    "statistics": statistics,
                }
                # write out
                os.makedirs(os.path.dirname(filename_json), exist_ok=True)
                with open(filename_json, "w") as outfile:
                    outfile.write(jsons.dumps(dataset_annotated))
                file_log.debug(
                    "[%s] wrote annotated results to %s",
                    self.process_name,
                    filename_json,
                )

            except (ValueError, IOError) as e:
                file_log.error(
                    "[%s] Annotation failed with error: %s", self.process_name, str(e)
                )
                dataset_annotated = None

        return dataset_annotated


async def amain():
    parser = argparse.ArgumentParser(
        description="annotates, filters, aggregates OpenBikeSensor files, and exports "
        "them for visualization"
    )

    parser.add_argument(
        "-A",
        "--annotate",
        required=False,
        action="store_true",
        help="annotates measurements using OSM data",
    )
    parser.add_argument(
        "-C",
        "--collect",
        required=False,
        action="store_true",
        help="collects all confirmed and valid measurements and stores it in one file",
    )
    parser.add_argument(
        "-V",
        "--visualization",
        required=False,
        action="store_true",
        help="creates the GeoJson data required by the OBS visualization",
    )

    parser.add_argument(
        "-i",
        "--input",
        required=False,
        action="store",
        default=None,
        help="path to the location where CSV data files are located",
    )
    parser.add_argument(
        "-e",
        "--input-exclude",
        required=False,
        action="append",
        default=[],
        help="data to be excluded, given by path prefix in the input directory tree",
    )

    parser.add_argument(
        "-b",
        "--base-path",
        required=False,
        action="store",
        default="./data/",
        help="base path to where all data is stored",
    )
    parser.add_argument(
        "--no-base-path",
        action="store_const",
        const=None,
        dest="base_path",
        help="do not use a base path (provide explicit paths as required)",
    )

    parser.add_argument(
        "--path-annotated",
        required=False,
        action="store",
        default=None,
        help="path for storing annotated data",
    )
    parser.add_argument(
        "--path-output-collected",
        required=False,
        action="store",
        default=None,
        help="filename for storing collected data",
    )
    parser.add_argument(
        "--output-geojson-roads",
        required=False,
        action="store",
        default=None,
        help="filename for storing roads visualization GeoJson data",
    )
    parser.add_argument(
        "--output-geojson-measurements",
        required=False,
        action="store",
        default=None,
        help="filename for storing measurement visualization GeoJson data",
    )

    parser.add_argument(
        "--path-cache",
        required=False,
        action="store",
        default="./cache",
        help="path where the visualization data will be stored",
    )

    parser.add_argument(
        "-D",
        "--district",
        required=False,
        action="append",
        default=[],
        help="DEPRECATED; required map parts are now selected automatically",
    )

    parser.add_argument(
        "--left-hand-traffic",
        required=False,
        action="store_false",
        dest="right_hand_traffic",
        default=True,
        help="switches to left-hand traffic (otherwise: right-hand traffic); right instead left "
        "sensor is used, and the exported visualization is adapted",
    )

    parser.add_argument(
        "-p",
        "--parallel",
        required=False,
        action="store",
        default=0,
        type=int,
        help="disables parallel processing if 0, otherwise defines the number of worker processes ",
    )

    parser.add_argument(
        "--recompute",
        required=False,
        action="store_true",
        default=False,
        help="always recompute annotation results",
    )

    parser.add_argument(
        "--anonymize-user-id",
        action="store",
        type=AnonymizationMode,
        default=AnonymizationMode.REMOVE,
        metavar="remove|hashed|keep",
        help='Choose whether to "remove" user ID (default), store only "hashed" versions (requires --anonymization-hash-salt) or "keep" '
        "the full user ID in outputs.",
    )

    parser.add_argument(
        "--anonymize-measurement-id",
        action="store",
        type=AnonymizationMode,
        default=AnonymizationMode.REMOVE,
        metavar="remove|hashed|keep",
        help='Choose whether to "remove" measurement ID, store only "hashed" versions (requires --anonymization-hash-salt) or "keep" '
        "the full measurement ID in outputs.",
    )

    parser.add_argument(
        "--anonymization-hash-salt",
        action="store",
        type=str,
        help="A salt/seed for use when hashing user or measurement IDs. Arbitrary string, but kept secret.",
    )

    parser.add_argument("-v", "--verbose", action="store_true", help="be verbose")

    args = parser.parse_args()

    coloredlogs.install(
        level=logging.DEBUG if args.verbose else logging.INFO,
        fmt="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    if args.base_path is not None:
        if args.input is None:
            args.input = os.path.join(args.base_path, "input")
        if args.path_annotated is None:
            args.path_annotated = os.path.join(args.base_path, "annotated")
        if args.path_output_collected is None:
            args.path_output_collected = os.path.join(
                args.base_path, "collected", "measurements.json"
            )
        if args.output_geojson_roads is None:
            args.output_geojson_roads = os.path.join(
                args.base_path, "visualization", "roads.json"
            )
        if args.output_geojson_measurements is None:
            args.output_geojson_measurements = os.path.join(
                args.base_path, "visualization", "measurements.json"
            )

    if (
        args.anonymize_user_id == AnonymizationMode.HASHED
        and args.anonymization_hash_salt is None
    ):
        raise ValueError(
            "--anonymization-hash-salt is required for --anonymize-user-id=hashed"
        )

    if (
        args.anonymize_measurement_id == AnonymizationMode.HASHED
        and args.anonymization_hash_salt is None
    ):
        raise ValueError(
            "--anonymization-hash-salt is required for --anonymize-measurement-id=hashed"
        )

    if args.district:
        log.warning(
            "--district parameter is deprecated; required map parts are now selected automatically"
        )

    log.debug("parameter list:")
    log.debug("input=%s", args.input)
    log.debug("path_annotated=%s", args.path_annotated)
    log.debug("path_output_collected=%s", args.path_output_collected)
    log.debug("anonymize user ID=%s", args.anonymize_user_id)
    log.debug("anonymize measurement ID=%s", args.anonymize_measurement_id)
    log.debug("traffic=%s hand", "right" if args.right_hand_traffic else "left")

    if args.annotate or args.collect or args.visualization:
        logging.info("Loading OpenStreetMap data")
        tile_source = OverpassTileSource(cache_dir=args.cache_dir)
        map_source = DataSource(tile_source)

    if args.annotate or args.collect:
        if not args.input:
            logging.error("--input or --base-path required")
            sys.exit(1)

        if not args.path_annotated:
            logging.error("--path-annotated or --base-path required")
            sys.exit(1)

        log.info("Collecting datasets")
        datasets = collect_datasets(args.input, args.input_exclude)

        log.info("Annotating and filtering CSV files")
        measurements, statistics = process_datasets(
            datasets,
            args.path_annotated,
            map_source,
            path_cache=args.path_cache,
            skip_if_json_exists=not args.recompute,
            n_worker_processes=args.parallel,
            process_parallel=args.parallel > 0,
        )

        log.info("Statistics:")
        log.info("number of files:        %s", statistics["n_files"])
        log.info("total measurements:     %s", statistics["n_measurements"])
        log.info("valid measurements:     %s", statistics["n_valid"])
        log.info("confirmed measurements: %s", statistics["n_confirmed"])
        log.info(
            "time range:             %s to %s", statistics["t_min"], statistics["t_max"]
        )
        log.info("continuous time:        %ss", statistics["t"])
        log.info("continuous distance:    %sm", statistics["d"])
        log.info("continuous segments:    %s", statistics["n_segments"])

    if args.collect:
        if not args.path_output_collected:
            log.error("--path-output-collected or --base-path required")
            sys.exit(1)

        log.info("exporting collected measurements")

        # write out
        os.makedirs(os.path.dirname(args.path_output_collected), exist_ok=True)
        with open(args.path_output_collected, "w") as outfile:
            outfile.write(
                jsons.dumps({"measurements": measurements, "statistics": statistics})
            )

    if args.visualization:
        if not args.path_output_collected:
            log.error("--path-output-collected or --base-path required")
            sys.exit(1)

        if not args.output_geojson_measurements:
            log.error("--output-geojson-measurements or --base-path required")
            sys.exit(1)

        if not args.output_geojson_roads:
            log.error("--output-geojson-roads or --base-path required")
            sys.exit(1)

        log.info("exporting visualization data")

        with open(args.path_output_collected, "r") as infile:
            data = jsons.loads(infile.read())
        measurements = data["measurements"]

        # always filter for privacy
        measurements = PrivacyFilter(
            user_id_mode=args.anonymize_user_id,
            measurement_id_mode=args.anonymize_measurement_id,
            hash_salt=args.anonymization_hash_salt,
        ).filter(measurements)

        log.info("exporting GeoJson measurements")
        exporter = ExportMeasurements(args.output_geojson_measurements, do_filter=True)
        await exporter.add_measurements(measurements)
        exporter.finalize()

        log.info("exporting GoeJson roads")
        exporter = ExportRoadAnnotation(
            args.output_geojson_roads,
            map_source,
            right_hand_traffic=args.right_hand_traffic,
        )
        await exporter.add_measurements(measurements)
        exporter.finalize()

    log.info("done")


def main():
    asyncio.run(amain())


if __name__ == "__main__":
    main()
