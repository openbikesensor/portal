import json
import os
import numpy as np
import logging
from Mapping.LocalMap import AzimuthalEquidistant as LocalMap


class ExportRoadAnnotation:
    def __init__(self, filename, osm, right_hand_traffic=True):
        self.filename = filename
        self.osm = osm
        self.features = None
        self.n_samples = 0
        self.n_valid = 0
        self.n_grouped = 0
        self.way_statistics = {}
        self.only_confirmed_measurements = True
        self.right_hand_traffic = right_hand_traffic

        lat_0, lon_0 = osm.get_map_center()
        self.local_map = LocalMap(lat_0, lon_0)

    def add_measurements(self, measurements):
        for sample in measurements:
            self.n_samples += 1
            # filter measurements
            if sample["latitude"] is None or sample["longitude"] is None or sample["distance_overtaker"] is None \
                    or self.only_confirmed_measurements and (sample["confirmed"] is not True) \
                    or not sample["has_OSM_annotations"]:
                continue

            self.n_valid += 1

            way_id = sample["OSM_way_id"]
            value = sample["distance_overtaker"]
            way_orientation = sample["OSM_way_orientation"]

            if way_id in self.way_statistics:
                # way statistic object already created
                self.way_statistics[way_id].add_sample(value, way_orientation)
                self.n_grouped += 1
            elif way_id in self.osm.ways:
                # statistic object not created, but OSM way exists
                self.way_statistics[way_id] = WayStatistics(way_id, self.osm.ways[way_id]).add_sample(value, way_orientation)
                self.n_grouped += 1

    def finalize(self):
        logging.info("{} samples, {} valid".format(self.n_samples, self.n_valid))
        features = []
        for way in self.way_statistics.values():
            way.finalize()
            if not any(way.valid):
                continue

            coordinates = self.get_way_coordinates(way.way_id)

            for i in range(1 if way.oneway else 2):
                #if not way.valid[i]:
                #    continue

                coordinates_i = coordinates if (i == 0) else list(reversed(coordinates))
                direction = 0 if way.oneway else +1 if i == 0 else -1

                coordinates_i = self.offset_road_coordinates(coordinates_i, direction, self.right_hand_traffic)

                feature = {"type": "Feature",
                           "properties": {"distance_overtaker_mean": way.d_mean[i],
                                          "distance_overtaker_median": way.d_median[i],
                                          "distance_overtaker_minimum": way.d_minimum[i],
                                          "distance_overtaker_n": way.n[i],
                                          "distance_overtaker_n_below_limit": way.n_lt_limit[i],
                                          "distance_overtaker_n_above_limit": way.n_geq_limit[i],
                                          "distance_overtaker_limit": way.d_limit,
                                          "distance_overtaker_measurements": way.samples[i],
                                          "zone": way.zone,
                                          "direction": direction,
                                          "name": way.name,
                                          "way_id": way.way_id,
                                          "valid": way.valid[i],
                                          },
                           "geometry": {"type": "LineString", "coordinates": coordinates_i}}

                features.append(feature)

        data = {"type": "FeatureCollection",
                "features": features}

        os.makedirs(os.path.dirname(self.filename), exist_ok=True)

        with open(self.filename, 'w') as f:
            json.dump(data, f)

    def get_way_coordinates(self, way_id):
        coordinates = []
        if way_id in self.osm.ways:
            way = self.osm.ways[way_id]
            if "nodes" in way:
                for node_id in way["nodes"]:
                    c = (self.osm.nodes[node_id]["lon"],
                         self.osm.nodes[node_id]["lat"])
                    coordinates.append(c)

        return coordinates

    def offset_road_coordinates(self, coordinates, direction, right_hand_traffic=True):
        if direction == 0:
            return coordinates

        # convert to coordinates in local map
        c = []
        for p in coordinates:
            c.append(self.local_map.transfer_to(p[1], p[0]))

        # compute normals, pointing to the right (for right-hand traffic) or left (for left-hand traffic)
        n = []
        orientation = +1 if right_hand_traffic else -1
        for i in range(len(c)-1):
            n_i = c[i+1] - c[i]
            n_i = n_i / np.linalg.norm(n_i)
            n_i = orientation * np.array([-n_i[1], +n_i[0]])
            n.append(n_i)

        # move points
        d = - 2.0
        coordinates_offset = []
        for i in range(len(c)):
            # create an average normal for each node
            n_prev = n[max(0, i-1)]
            n_next = n[min(len(n)-1, i)]
            n_i = 0.5*(n_prev + n_next)
            # make sure it is normalized
            n_i = n_i / np.linalg.norm(n_i)
            # then move the point
            c_i = c[i] + n_i * d
            c_i = self.local_map.transfer_from(c_i)
            coordinates_offset.append([c_i[1], c_i[0]])

        return coordinates_offset


class WayStatistics:
    def __init__(self, way_id, way):
        self.samples = [[], []]
        self.n = [0, 0]
        self.n_lt_limit = [0, 0]
        self.n_geq_limit = [0, 0]

        self.way_id = way_id
        self.valid = [False, False]
        self.d_mean = [0, 0]
        self.d_median = [0, 0]
        self.d_minimum = [0, 0]

        self.zone = "unknown"
        self.oneway = False
        self.name = "unknown"

        if "tags" in way:
            tags = way["tags"]
            if "zone:traffic" in tags:
                zone = tags["zone:traffic"]
                if zone == "DE:urban":
                    zone = "urban"
                elif zone == "DE:rural":
                    zone = "rural"
                elif zone == "DE:motorway":
                    zone = "motorway"
                self.zone = zone

            if "oneway" in tags:
                self.oneway = tags["oneway"] == "yes"

            if "name" in tags:
                self.name = tags["name"]

        self.d_limit = 1.5 if self.zone == "urban" else 2.0 if self.zone == "rural" else 1.5

    def add_sample(self, sample, orientation):
        if np.isfinite(sample):
            i = 1 if orientation == -1 else 0
            self.samples[i].append(sample)
        return self

    def finalize(self):
        for i in range(2):
            samples = np.array(self.samples[i])
            if len(samples) > 0:
                self.n[i] = len(samples)
                self.d_mean[i] = np.mean(samples)
                self.d_median[i] = np.median(samples)
                self.d_minimum[i] = np.min(samples)
                if self.d_limit is not None:
                    self.n_lt_limit[i] = int((samples < self.d_limit).sum())
                    self.n_geq_limit[i] = int((samples >= self.d_limit).sum())
                self.valid[i] = True
