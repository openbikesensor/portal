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

from enum import Enum
import hashlib
import logging
from typing import List

from geopy.distance import geodesic
from memoization import cached

from .MeasurementFilter import MeasurementFilter

module_log = logging.getLogger(__name__)


class PrivacyZone:
    latitude: float
    longitude: float
    radius: float = 200  # in meters

    def __init__(self, latitude, longitude, radius):
        self.latitude = latitude
        self.longitude = longitude
        self.radius = radius

    def contains(self, lat: float, lng: float) -> bool:
        return (
            geodesic((lat, lng), (self.latitude, self.longitude)).meters <= self.radius
        )


class PrivacyZonesFilter(MeasurementFilter):
    def __init__(self, privacy_zones: List[PrivacyZone]):
        self.privacy_zones = privacy_zones

    def filter(self, measurements, log=module_log):
        # This is a slow and naive implementation, but it will work for now.
        # Suggested improvements:
        # - speed up algorithm
        # - maybe do not filter zones that are just being passed through without stop
        def _process():
            for measurement in measurements:
                in_zone = any(
                    zone.contains(measurement["latitude"], measurement["longitude"])
                    for zone in self.privacy_zones
                )
                if not in_zone:
                    yield measurement

        return list(_process())
