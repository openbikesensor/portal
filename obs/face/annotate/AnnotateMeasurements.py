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

import numpy as np
import datetime

from obs.face.mapping import Roads
from .BeliefPropagationChain import BeliefPropagationChain as BP


class AnnotateMeasurements:
    def __init__(self, map_source, cache_dir='cache', osm_projection="filtered", fully_annotate_unconfirmed=False):
        self.fully_annotate_unconfirmed = fully_annotate_unconfirmed

        self.map_source = map_source
        self.roads = Roads(map_source, d_max=40.0, d_phi_max=90, cache_dir=cache_dir)

        if osm_projection == "greedy":
            self.add_osm_way_id = self.add_osm_way_id_greedy
        elif osm_projection == "filtered":
            self.add_osm_way_id = self.add_osm_way_id_filtered
        else:
            raise(ValueError("invalid value for osm_projection: " + osm_projection))

    def annotate(self, measurements):
        # ensure that the relevant parts of the map is loaded
        self.ensure_map_coverage(measurements)

        # add OSM file id
        measurements = self.add_osm_way_id(measurements)

        # add annotations
        measurements = self.add_osm_annotations(measurements)

        return measurements

    def ensure_map_coverage(self, measurements):
        lat = [m["latitude"] for m in measurements]
        lon = [m["longitude"] for m in measurements]

        self.map_source.ensure_coverage(lat, lon)

    def annotate_ways(self, m):
        way_id = m["OSM_way_id"]
        way = self.map_source.get_way_by_id(way_id)
        if way_id is not None and way is not None:
            tags = way.tags
            if "zone:traffic" in tags:
                zone = tags["zone:traffic"]
                if zone == "DE:urban":
                    zone = "urban"
                elif zone == "DE:rural":
                    zone = "rural"
                elif zone == "DE:motorway":
                    zone = "motorway"
                m["OSM_zone"] = zone

            if "maxspeed" in tags:
                m["OSM_maxspeed"] = tags["maxspeed"]
            if "name" in tags:
                m["OSM_name"] = tags["name"]
            if "oneway" in tags:
                m["OSM_oneway"] = tags["oneway"]
            if "lanes" in tags:
                m["OSM_lanes"] = tags["lanes"]
            if "highway" in tags:
                m["OSM_highway"] = tags["highway"]

        return m

    def add_osm_way_id_greedy(self, measurements):
        measurements_annotated = []
        for m in measurements:
            if m["confirmed"] or True:
                # way_id, way_orientation, lat_lon_projected = self.roads.get_closest_way_oriented(m)
                way_id, way_orientation, lat_projected, lon_projected, distance = \
                    self.roads.get_n_closest_ways_oriented(m, 1)
                if way_id:
                    m["OSM_way_id"] = way_id[0]
                    m["OSM_way_orientation"] = way_orientation[0]
                    m["latitude_projected"] = lat_projected[0]
                    m["longitude_projected"] = lon_projected[0]

            measurements_annotated.append(m)

        return measurements_annotated

    def add_osm_way_id_filtered(self, measurements):
        measurements_annotated = []

        m_prev = None
        matching_id_prev = ['none']

        chain = []
        for m in measurements:
            way_id, way_orientation, lat_projected, lon_projected, distance = self.roads.get_n_closest_ways_oriented(m, 3)
            m["OSM_way_id"] = way_id
            m["OSM_way_orientation"] = way_orientation
            m["latitude_projected"] = lat_projected
            m["longitude_projected"] = lon_projected
            m["distance_projected"] = distance

            # matching id
            if way_id:
                matching_distance = distance
                matching_id = [[]]*len(way_id)
                for i, way_id_i in enumerate(way_id):
                    way = self.map_source.get_way_by_id(way_id_i)
                    if "name" in way.tags:
                        matching_id[i] = way.tags["name"]
                    else:
                        matching_id[i] = str(way_id_i)
            else:
                matching_id = matching_id_prev
                matching_distance = [0] * len(matching_id)

            m["matching_distance"] = matching_distance
            m["matching_id"] = matching_id

            # decide if we split the chain before m
            # do_split = m["discontinuity"]
            do_split = (m_prev is not None) and (m["user_id"] != m_prev["user_id"])

            # the chain ends here, now solve for the best solution
            if do_split:
                measurements_annotated += self.solve_chain(chain)
                chain = []

            # add the current entry
            chain.append(m)

            # keep for next iteration
            m_prev = m
            matching_id_prev = matching_id

        measurements_annotated += self.solve_chain(chain)

        return measurements_annotated

    def solve_chain(self, chain):
        # http://helper.ipam.ucla.edu/publications/gss2013/gss2013_11344.pdf
        n = len(chain)
        if n == 0:
            return []

        # construct chain
        p_way_id_constant = 0.999
        p_way_id_change = 1.0 - p_way_id_constant
        a_distance = 100

        gm = BP()

        for i in range(n):
            c_i = chain[i]
            phi_i = np.exp(-np.array(c_i["matching_distance"])/a_distance)
            phi_i = phi_i / np.sum(phi_i)

            j = i + 1
            if j == n:
                psi_ij = None
            else:
                w_i = c_i["matching_id"]
                c_j = chain[j]
                w_j = c_j["matching_id"]

                if len(w_i) > 0 and len(w_j) > 0:
                    psi_ij = [[p_way_id_constant if w_i_k == w_j_l else p_way_id_change
                               for w_j_l in w_j] for w_i_k in w_i]
                    psi_ij = np.array(psi_ij)
                else:
                    psi_ij = np.empty([len(w_i), len(w_j)])

            gm.add_node(phi_i, psi_ij)

        result = gm.max_joint_probability()

        for i in range(n):
            ix = result[i]
            c = chain[i]

            # print("{:5d} {:40s} ".format(i, c["measurement_id"]), end="")
            # for j in range(len(c["OSM_way_id"])):
            #    if j == ix:
            #        print("[{:12s} {:5.2f}]  ".format(c["matching_id"][j], c["distance_projected"][j]), end="")
            #    else:
            #        print(" {:12s} {:5.2f}   ".format(c["matching_id"][j], c["distance_projected"][j]), end="")
            # print()

            if c["OSM_way_id"]:
                c["OSM_way_id"] = c["OSM_way_id"][ix]
                c["OSM_way_orientation"] = c["OSM_way_orientation"][ix]
                c["latitude_projected"] = c["latitude_projected"][ix]
                c["longitude_projected"] = c["longitude_projected"][ix]
                c["distance_projected"] = c["distance_projected"][ix]
            else:
                # this point did not have any associated way
                del c["OSM_way_id"]
                del c["OSM_way_orientation"]
                del c["latitude_projected"]
                del c["longitude_projected"]
                del c["distance_projected"]

            del c["matching_id"]
            del c["matching_distance"]
            # chain[i] = c

        return chain

    def add_osm_annotations(self, measurements):
        measurements_annotated = []
        for m in measurements:
            if (self.fully_annotate_unconfirmed or m["confirmed"] is True) and "OSM_way_id" in m:
                m["has_OSM_annotations"] = True
                # replace lat/lon by projected values, but backup original values
                m["latitude_GPS"] = m["latitude"]
                m["latitude"] = m["latitude_projected"]

                m["longitude_GPS"] = m["longitude"]
                m["longitude"] = m["longitude_projected"]

                m = self.annotate_ways(m)
            else:
                m["has_OSM_annotations"] = False
                m["latitude_GPS"] = m["latitude"]
                m["longitude_GPS"] = m["longitude"]
                m["latitude_projected"] = None
                m["longitude_projected"] = None

            measurements_annotated.append(m)

        return measurements_annotated
