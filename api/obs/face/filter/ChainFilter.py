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

import sys
import logging

from .MeasurementFilter import MeasurementFilter

module_log = logging.getLogger(__name__)


class ChainFilter(MeasurementFilter):
    def __init__(self, *filters):
        self.filters = filters

    def filter(self, measurements, log=module_log):
        for filter_ in self.filters:
            measurements = filter_.filter(measurements, log)
        log.debug("Applied %s filters.", len(self.filters))
        return measurements
