from os.path import abspath, join, dirname, exists

import pytest

@pytest.fixture(name="test_data_dir")
def test_data_dir_fixture():
    if exists(join(dirname(__file__), '..', 'test-data')):
        return abspath(join(dirname(__file__), '..', 'test-data'))
    return abspath(join(dirname(__file__), 'test-data'))
