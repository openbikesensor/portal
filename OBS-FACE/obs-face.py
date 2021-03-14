import argparse
import pathlib
from multiprocessing import Process, Queue
import logging
import os
import jsons
import time

from OpenBikeSensor.ImportMeasurementsCsv import ImportMeasurementsCsv
from Annotation.AnnotateMeasurements import AnnotateMeasurements
from Filter.MeasurementFilter import MeasurementFilter
from GeoJson.ExportMeasurements import ExportMeasurements
from GeoJson.ExportRoadAnnotations import ExportRoadAnnotation
from OpenStreetMap.DataSource import DataSource as OSM
from Filter.PrivacyFilter import PrivacyFilter


def collect_datasets(path, exclusion_list):
    datasets = []
    path_absolute = os.path.abspath(path)

    for root, dirs, files in os.walk(path):
        unused, user_id = os.path.split(root)
        for filename in files:
            filename_no_extension, extension = os.path.splitext(filename)
            if extension == ".csv":
                filename_absolute = os.path.abspath(os.path.join(root, filename))
                filename_relative = os.path.relpath(filename_absolute, start=path_absolute)

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
                    logging.info("adding " + filename_relative)
                else:
                    logging.info("excluding " + filename_relative)

    return datasets


def process_datasets(datasets, path_annotated, osm, skip_if_json_exists=True, path_cache='./cache',
                     n_worker_processes=1, process_parallel=True, right_hand_traffic=True):
    logging.info("annotating datasets")

    annotator = AnnotateMeasurements(osm, cache_dir=path_cache)
    measurement_filter = MeasurementFilter()
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
        dummy_process = AnnotationProcess(0, input_queue, output_queue, importer, annotator, measurement_filter,
                                          path_annotated, skip_if_json_exists)

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
        "d": 0
    }

    n_out = 0
    while not finished:
        # analyze
        n_alive = 0
        for p in processes:
            n_alive += (p is not None) and p.is_alive()

        finished = output_queue.empty() and input_queue.empty() and (n_out == n_in)

        print("datasets: total {}, input queue {}, output queue {}, finished {} ({} measurements); "
              "worker: running {}, total {}".format(n_in, input_queue.qsize(), output_queue.qsize(),
                                                    n_out, len(measurements),
                                                    n_alive, len(processes)), end="\n")

        if process_parallel:
            # (re)spawn processes
            if not finished:
                for [process_id, p] in enumerate(processes):
                    if p is None or not p.is_alive():
                        q = AnnotationProcess(process_id, input_queue, output_queue, importer, annotator,
                                              measurement_filter, path_annotated, skip_if_json_exists)
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
        "t_min": a["t_min"] if a["t_min"] is not None and (b["t_min"] is None or a["t_min"] < b["t_min"]) else b[
            "t_min"],
        "t_max": a["t_max"] if a["t_max"] is not None and (b["t_max"] is None or a["t_max"] > b["t_max"]) else b[
            "t_max"],
        "t_total": a["t_total"] + b["t_total"],
        "n_segments": a["n_segments"] + b["n_segments"],
        "t": a["t"] + b["t"],
        "d": a["d"] + b["d"]
    }
    return stats


class AnnotationProcess(Process):
    def __init__(self, process_id, job_queue, result_queue, importer, annotator, measurement_filter, path_annotated,
                 skip_if_json_exists):
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
        filename_json = os.path.join(self.path_annotated,
                                     os.path.splitext(dataset["filename_relative"])[0] + '.json')

        dataset_annotated = None
        do_annotate = True
        if self.skip_if_json_exists and os.path.isfile(filename_json):
            t1 = pathlib.Path(dataset["filename"]).stat().st_mtime
            t2 = pathlib.Path(filename_json).stat().st_mtime

            if t1 <= t2:
                logging.debug("using cached result: " + filename_json)
                with open(filename_json, 'r') as infile:
                    dataset_annotated = jsons.loads(infile.read())
                do_annotate = False
            else:
                logging.debug("cached result is outdated")

        if do_annotate:
            filename_log = os.path.join(self.path_annotated,
                                        os.path.splitext(dataset["filename_relative"])[0] + '.log')

            os.makedirs(os.path.dirname(filename_log), exist_ok=True)
            with open(filename_log, "w") as log:
                try:
                    measurements, statistics = self.importer.read(dataset["filename"], user_id=dataset["user_id"],
                                                                  dataset_id=dataset["filename_relative"],
                                                                  log=log)
                    measurements = self.annotator.annotate(measurements)

                    measurements = self.measurement_filter.filter(measurements, log=log)

                    dataset_annotated = {"measurements": measurements, "statistics": statistics}
                    # write out
                    os.makedirs(os.path.dirname(filename_json), exist_ok=True)
                    with open(filename_json, 'w') as outfile:
                        outfile.write(jsons.dumps(dataset_annotated))

                except ValueError as e:
                    print("FAILED: " + str(e))
                    dataset_annotated = None
                except IOError as e:
                    print("FAILED: " + str(e))
                    dataset_annotated = None

        return dataset_annotated


def main():
    logging.basicConfig(level=logging.DEBUG, format='%(levelname)s: %(message)s')

    parser = argparse.ArgumentParser(description='annotates, filters, aggregates OpenBikeSensor files, and exports '
                                                 'them for visualization')

    parser.add_argument('-A', '--annotate', required=False, action='store_true',
                        help='annotates measurements using OSM data')
    parser.add_argument('-C', '--collect', required=False, action='store_true',
                        help='collects all confirmed and valid measurements and stores it in one file')
    parser.add_argument('-V', '--visualization', required=False, action='store_true',
                        help='creates the GeoJson data required by the OBS visualization')

    parser.add_argument('-i', '--input', required=False, action='store', default=None,
                        help='path to the location where CSV data files are located')
    parser.add_argument('-e', '--input-exclude', required=False, action='append', default=[],
                        help='data to be excluded, given by path prefix in the input directory tree')

    parser.add_argument('-b', '--base-path', required=False, action='store', default='./data/',
                        help='base path to where all data is stored')

    parser.add_argument('--path-annotated', required=False, action='store', default=None,
                        help='path for storing annotated data')
    parser.add_argument('--output-collected', required=False, action='store', default=None,
                        help='filename for storing collected data')
    parser.add_argument('--output-geojson-roads', required=False, action='store', default=None,
                        help='filename for storing roads visualization GeoJson data')
    parser.add_argument('--output-geojson-measurements', required=False, action='store', default=None,
                        help='filename for storing measurement visualization GeoJson data')

    parser.add_argument('--path-cache', required=False, action='store', default='./cache',
                        help='path where the visualization data will be stored')

    parser.add_argument('-D', '--district', required=False, action='append', default=[],
                        help='name of a district (Landkreis) from which the OSM data should be used, can be used '
                             'several times')

    parser.add_argument('--left-hand-traffic', required=False, action='store_false', dest='right_hand_traffic',
                        default=True,
                        help='switches to left-hand traffic (otherwise: right-hand traffic); right instead left '
                             'sensor is used, and the exported visualization is adapted')

    parser.add_argument('-p', '--parallel', required=False, action='store', default=0, type=int,
                        help='disables parallel processing if 0, otherwise defines the number of worker processes ')

    parser.add_argument('--recompute', required=False, action='store_true', default=False,
                        help='always recompute annotation results')

    args = parser.parse_args()

    if args.input is None:
        args.input = os.path.join(args.base_path, 'input')
    if args.path_annotated is None:
        args.path_annotated = os.path.join(args.base_path, 'annotated')
    if args.output_collected is None:
        args.output_collected = os.path.join(args.base_path, 'collected', 'measurements.json')
    if args.output_geojson_roads is None:
        args.output_geojson_roads = os.path.join(args.base_path, 'visualization', 'roads.json')
    if args.output_geojson_measurements is None:
        args.output_geojson_measurements = os.path.join(args.base_path, 'visualization', 'measurements.json')

    logging.debug("parameter list:")
    logging.debug("input=" + args.input)
    logging.debug("path_annotated=" + args.path_annotated)
    logging.debug("output_collected=" + args.output_collected)

    logging.debug("district=" + "|".join(args.district))
    logging.debug("traffic=" + ("right hand" if args.right_hand_traffic else "left hand"))

    if args.annotate or args.collect or args.visualization:
        logging.info('Loading OpenStreetMap data')
        osm = OSM(areas=args.district, query_family="roads_in_admin_boundary", cache_dir=args.path_cache)

    if args.annotate or args.collect:
        logging.info('Collecting datasets')
        datasets = collect_datasets(args.input, args.input_exclude)

        logging.info('Annotating and filtering CSV files')
        measurements, statistics = process_datasets(datasets, args.path_annotated, osm, path_cache=args.path_cache,
                                                    skip_if_json_exists=not args.recompute,
                                                    n_worker_processes=args.parallel,
                                                    process_parallel=args.parallel > 0)

        logging.info("Statistics:")
        logging.info("number of files:        {}".format(statistics["n_files"]))
        logging.info("total measurements:     {}".format(statistics["n_measurements"]))
        logging.info("valid measurements:     {}".format(statistics["n_valid"]))
        logging.info("confirmed measurements: {}".format(statistics["n_confirmed"]))
        logging.info("time range:             {} to {}".format(statistics["t_min"], statistics["t_max"]))
        logging.info("continuous time:        {}s".format(statistics["t"]))
        logging.info("continuous distance:    {}m".format(statistics["d"]))
        logging.info("continuous segments:    {}".format(statistics["n_segments"]))

    if args.collect:
        logging.info("exporting collected measurements")
        # write out
        os.makedirs(os.path.dirname(args.output_collected), exist_ok=True)
        with open(args.output_collected, 'w') as outfile:
            outfile.write(jsons.dumps({"measurements": measurements, "statistics": statistics}))

    if args.visualization:
        logging.info("exporting visualization data")
        with open(args.output_collected, 'r') as infile:
            data = jsons.loads(infile.read())
        measurements = data["measurements"]

        # always filter for privacy
        measurements = PrivacyFilter(create_measurement_pseudonyms=True).filter(measurements)

        logging.info("exporting GeoJson measurements")
        exporter = ExportMeasurements(args.output_geojson_measurements, do_filter=True)
        exporter.add_measurements(measurements)
        exporter.finalize()

        logging.info("exporting GoeJson roads")
        exporter = ExportRoadAnnotation(args.output_geojson_roads, osm, right_hand_traffic=args.right_hand_traffic)
        exporter.add_measurements(measurements)
        exporter.finalize()

    logging.info("done")


if __name__ == "__main__":
    main()
