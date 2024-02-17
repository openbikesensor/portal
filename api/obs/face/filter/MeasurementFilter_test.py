from os.path import join

from obs.face.importer import ImportMeasurementsCsv
from obs.face.filter import MeasurementFilter

def test_zero_zero_bug(test_data_dir):
    measurements, _ = ImportMeasurementsCsv().read(
        join(test_data_dir, 'zero-zero-bug.csv'),
        user_id="dummy",
        dataset_id="dummy",
    )

    def has_zero_zero(m):
        return not m['latitude'] and not m['longitude']

    # There should be zeroes in here
    assert any(map(has_zero_zero, measurements))

    measurement_filter = MeasurementFilter()
    measurements = measurement_filter.filter(measurements)

    # Now there should be no more zeroes
    assert not any(map(has_zero_zero, measurements))
