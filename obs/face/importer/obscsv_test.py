import pytz
from os.path import dirname, join, abspath
from datetime import datetime

from .obscsv import ImportMeasurementsCsv

TESTDATA_DIR = abspath(join(dirname(__file__), '..', '..', '..', 'test-data'))

def test_gps_time():
    measurements, statistics = ImportMeasurementsCsv().read(
        join(TESTDATA_DIR, 'gps-time.csv'),
        user_id="dummy",
        dataset_id="dummy",
    )
    gps_leap_seconds = 18
    actual_time = datetime(2021, 6, 26, 14, 39, 39 - gps_leap_seconds, tzinfo=pytz.UTC)
    assert measurements[0]['time'] == actual_time
