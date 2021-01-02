import hashlib


class PrivacyFilter:

    def __init__(self, pseudonymization_salt="3EHLFQRNBT4TnXZaxje8W5UTU1WV_vUS",
                 create_user_pseudonyms=True,
                 create_measurement_pseudonyms=True):
        self.keys_keep = ['time', 'longitude', 'latitude', 'distance_overtaker', 'distance_stationary', 'confirmed',
                          'course', 'speed', 'user_id', 'measurement_id', 'egomotion_is_derived', 'OSM_way_id',
                          'OSM_way_orientation', 'latitude_projected', 'longitude_projected', 'distance_projected',
                          'matching_id', 'has_OSM_annotations', 'latitude_GPS', 'longitude_GPS', 'OSM_zone',
                          'OSM_maxspeed', 'OSM_name', 'OSM_oneway', 'OSM_lanes', 'OSM_highway']

        # 'in_privacy_zone',  'discontinuity',

        self.pseudonymization_salt = pseudonymization_salt
        self.create_user_pseudonyms = create_user_pseudonyms
        self.create_measurement_pseudonyms = create_measurement_pseudonyms

        self.user_pseudonymization = {}
        self.dataset_pseudonymization = {}

    def filter(self, measurements):
        # only keep measurements which are not marked as private
        measurements_filtered = [m for m in measurements
                                 if ("in_privacy_zone" in m) and m["in_privacy_zone"] is not True]

        # only keep selected fields
        measurements_filtered2 = [{key: value for key, value in m.items() if key in self.keys_keep}
                                  for m in measurements_filtered]

        # replace user_id and measurement_id by pseudonyms
        for m in measurements_filtered2:
            if self.create_user_pseudonyms and "user_id" in m:
                user_id = m["user_id"]
                user_id_pseudonym = "user_" + hashlib.md5((self.pseudonymization_salt + m["user_id"]).encode()) \
                                                  .hexdigest()[0:-1:2]
                m["user_id"] = user_id_pseudonym
                if user_id_pseudonym not in self.user_pseudonymization:
                    self.user_pseudonymization[user_id_pseudonym] = user_id

            if self.create_measurement_pseudonyms and "measurement_id" in m:
                measurement_id = m["measurement_id"]
                ix = measurement_id.rfind(":")
                dataset_id, line_id = (measurement_id, "") if ix == -1 else (measurement_id[:ix], measurement_id[ix:])
                dataset_id_pseudonym = hashlib.md5((self.pseudonymization_salt + dataset_id).encode()) \
                                           .hexdigest()[0:-1:2]
                m["measurement_id"] = dataset_id_pseudonym + line_id
                if dataset_id_pseudonym not in self.dataset_pseudonymization:
                    self.dataset_pseudonymization[dataset_id_pseudonym] = dataset_id

        return measurements_filtered2
