import pytz
from os.path import join
from datetime import datetime

from .obscsv import ImportMeasurementsCsv

def test_gps_time(test_data_dir):
    measurements, _ = ImportMeasurementsCsv().read(
        join(test_data_dir, 'gps-time.csv'),
        user_id="dummy",
        dataset_id="dummy",
    )
    gps_leap_seconds = 18
    actual_time = datetime(2021, 6, 26, 14, 39, 39 - gps_leap_seconds, tzinfo=pytz.UTC)
    assert measurements[0]['time'] == actual_time

def test_empty_metadata(test_data_dir):
    ImportMeasurementsCsv().read(
        join(test_data_dir, 'empty-metadata.csv'),
        user_id="dummy",
        dataset_id="dummy",
    )

def test_read_gzipped(test_data_dir):
    measurements, _ = ImportMeasurementsCsv().read(
        join(test_data_dir, 'gzipped.csv.gz'),
        user_id="dummy",
        dataset_id="dummy",
    )
    assert len(measurements) == 1
