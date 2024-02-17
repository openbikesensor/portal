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

from memoization import cached

from .MeasurementFilter import MeasurementFilter

module_log = logging.getLogger(__name__)


class AnonymizationMode(str, Enum):
    REMOVE = "remove"
    HASHED = "hashed"
    KEEP = "keep"


class PrivacyFilter(MeasurementFilter):
    def __init__(
        self,
        hash_salt=None,
        user_id_mode=AnonymizationMode.REMOVE,
        measurement_id_mode=AnonymizationMode.REMOVE,
    ):
        self.keys_keep = [
            "time",
            "longitude",
            "latitude",
            "distance_overtaker",
            "distance_stationary",
            "confirmed",
            "course",
            "speed",
            "user_id",
            "measurement_id",
            "egomotion_is_derived",
            "OSM_way_id",
            "OSM_way_orientation",
            "latitude_projected",
            "longitude_projected",
            "distance_projected",
            "matching_id",
            "has_OSM_annotations",
            "latitude_GPS",
            "longitude_GPS",
            "OSM_zone",
            "OSM_maxspeed",
            "OSM_name",
            "OSM_oneway",
            "OSM_lanes",
            "OSM_highway",
        ]
        # 'in_privacy_zone',  'discontinuity',

        if (
            AnonymizationMode.HASHED in [user_id_mode, measurement_id_mode]
            and hash_salt is None
        ):
            raise ValueError("needs hash_salt to hash user_id/measurement_id")

        self.hash_salt = hash_salt
        self.user_id_mode = user_id_mode
        self.measurement_id_mode = measurement_id_mode

        self.user_pseudonymization = {}
        self.dataset_pseudonymization = {}

    @cached
    def create_hash(self, value):
        hash_bytes = (self.hash_salt + value).encode("utf-8")
        hash_object = hashlib.sha512(hash_bytes)
        hex_hash = hash_object.hexdigest()
        return hex_hash[0::2]  # half the size

    def filter(self, measurements, log=module_log):
        # only keep measurements which are not marked as private
        measurements_filtered = [
            m
            for m in measurements
            if ("in_privacy_zone" in m) and m["in_privacy_zone"] is not True
        ]

        # only keep selected fields
        measurements_filtered2 = [
            {key: value for key, value in m.items() if key in self.keys_keep}
            for m in measurements_filtered
        ]

        # replace user_id and measurement_id by pseudonyms
        for m in measurements_filtered2:
            if self.user_id_mode == AnonymizationMode.HASHED and "user_id" in m:
                user_id = m["user_id"]
                user_id_pseudonym = "user_" + self.create_hash(m["user_id"])
                m["user_id"] = user_id_pseudonym
            elif self.user_id_mode == AnonymizationMode.REMOVE:
                m.pop("user_id", None)

            if (
                self.measurement_id_mode == AnonymizationMode.HASHED
                and "measurement_id" in m
            ):
                measurement_id = m["measurement_id"]
                ix = measurement_id.rfind(":")
                dataset_id, line_id = (
                    (measurement_id, "")
                    if ix == -1
                    else (measurement_id[:ix], measurement_id[ix:])
                )
                dataset_id_pseudonym = self.create_hash(dataset_id)
                m["measurement_id"] = dataset_id_pseudonym + line_id
                if dataset_id_pseudonym not in self.dataset_pseudonymization:
                    self.dataset_pseudonymization[dataset_id_pseudonym] = dataset_id
            elif self.measurement_id_mode == AnonymizationMode.REMOVE:
                m.pop("measurement_id", None)

        return measurements_filtered2
