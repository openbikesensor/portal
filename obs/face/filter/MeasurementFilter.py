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


class MeasurementFilter:

    def __init__(self, remove_invalid=True,
                 remove_unconfirmed=True):
        self.remove_invalid = remove_invalid
        self.remove_unconfirmed = remove_unconfirmed
        self.required_fields = ["time", "longitude", "latitude", "confirmed", "distance_overtaker"]

    def filter(self, measurements, log=sys.stdout):
        # filter out unconfirmed measurements
        if self.remove_unconfirmed:
            n = len(measurements)
            measurements = [m for m in measurements
                            if m["confirmed"] is True]
            log.write("filtered for confirmed only measurements: kept {} of {}\n".format(len(measurements), n))

        if self.remove_invalid:
            n = len(measurements)
            measurements = [m for m in measurements if
                            all(f in m and m[f] is not None for f in self.required_fields)
                            ]
            log.write("filtered for valid only measurements: kept {} of {}\n".format(len(measurements), n))

        return measurements
