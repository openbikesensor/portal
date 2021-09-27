from os.path import abspath, join, dirname

import pytest

@pytest.fixture(name="test_data_dir")
def test_data_dir_fixture():
    return abspath(join(dirname(__file__), 'test-data'))
