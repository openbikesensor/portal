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

import logging

from .MeasurementFilter import MeasurementFilter

module_log = logging.getLogger(__name__)


class RequiredFieldsFilter(MeasurementFilter):
    def __init__(self):
        self.required_fields = [
            "time",
            "longitude",
            "latitude",
        ]

    def filter(self, measurements, log=module_log):
        input_size = len(measurements)
        result = [
            measurement
            for measurement in measurements
            if all(measurement.get(field) is not None for field in self.required_fields)
        ]
        log.info("Removed %s invalid measurements", input_size - len(result))
        return result
