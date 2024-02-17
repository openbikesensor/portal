#!/usr/bin/python

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
import os
import csv
import math
import logging
import random

import coloredlogs
from haversine import haversine, Unit

import argparse
import struct
import urllib.parse


log = logging.getLogger(__name__)

def filter_csv_privacy(input, output, filter):
    with open(input) as file_in:
        reader = csv.reader(file_in, delimiter=';')

        with open(output, 'w') as file_out:
            writer = csv.writer(file_out, delimiter=';')

            header_verified = False

            filter_count = 0
            data_count = 0
            metadata = None

            for line_count, line in enumerate(reader):
                keep_line = True
                if not header_verified:
                    if line_count >= 2:
                        raise ValueError('could not verify file header')

                    line_identified = False
                    if metadata is None:
                        try:
                            metadata = urllib.parse.parse_qs(line[0], strict_parsing=True)
                            line_identified = True
                        except ValueError:
                            pass

                    if not line_identified:
                        # we did not find valid metadata, so check if this is a header line
                        if "Latitude" in line and "Longitude" in line:
                            ix_lat = line.index("Latitude")
                            ix_lon = line.index("Longitude")
                            header_verified = True
                        else:
                            raise ValueError("header line does not contain 'Longitude' and 'Latitude' fields")
                else:
                    data_count += 1
                    valid_coordinates = True
                    try:
                        lon = float(line[ix_lon])
                        lat = float(line[ix_lat])
                    except ValueError:
                        valid_coordinates = False

                    if valid_coordinates:
                        for f in filter:
                            d = haversine((lat, lon),
                                          (f["lat"], f["lon"]), unit=Unit.METERS)
                            if d <= f["radius"]:
                                log.debug("deleting measurement at %s %s, distance to %s %s is %s and below limit of %s", lat, lon, f["lat"], f["lon"], d, f["radius"])
                                keep_line = False
                                filter_count += 1

                if keep_line:
                    writer.writerow(line)

        log.debug("filtered %s data lines, removed %s lines", data_count, filter_count)


def move_lat_lon(lat1, lon1, bearing, d):
    # source: https://www.movable-type.co.uk/scripts/latlong.html
    R = 6371e3

    lat1 = math.radians(lat1)
    lon1 = math.radians(lon1)
    bearing = math.radians(bearing)

    lat2 = math.asin(math.sin(lat1) * math.cos(d / R) + math.cos(lat1) * math.sin(d / R) * math.cos(bearing))

    lon2 = lon1 + math.atan2(math.sin(bearing) * math.sin(d / R) * math.cos(lat1), math.cos(d / R) - math.sin(lat1)
                             * math.sin(lat2))

    lat2 = math.degrees(lat2)
    lon2 = math.degrees(lon2)

    return lat2, lon2


def read_zones(filename):
    lat_list = []
    lon_list = []
    radius_list = []
    with open(filename) as file_in:
        reader = csv.reader(file_in, delimiter=';')
        for line_nr, line in enumerate(reader):
            try:
                lat = float(line[0])
                lon = float(line[1])
                radius = float(line[2])
                lat_list.append(lat)
                lon_list.append(lon)
                radius_list.append(radius)
            except ValueError as e:
                log.error("Error in line %s of %s: %s", line_nr + 1, filename, str(e))

    return lat_list, lon_list, radius_list


def zone_random_number_generator(latitude, longitude, secret):
    """ Creates a pseudo-random number generator.
    It should be predictable if the 'latitude', 'longitude' and 'secret' is known.
    It should not be predictable without knowing the 'secret'.
    It should not behave identical for different zones. """

    # create a new instance of the random generator
    # we will set its seed, and do not want to influence others
    rng = random.Random()

    # collect secret ingredient, latitude and longitude into the seed
    seed = bytearray(secret, 'utf-8')
    seed += bytearray(struct.pack("d", latitude))
    seed += bytearray(struct.pack("d", longitude))

    # set the seed
    rng.seed(seed, version=2)

    return rng


def move_zone(zone, secret):
    if zone["rand_offset"] == 0:
        # nothing to do
        return zone

    rng = zone_random_number_generator(zone["lat"], zone["lon"], secret)

    direction = rng.uniform(0.0, 360.0)
    length = rng.uniform(0.0, zone["radius"] * zone["rand_offset"] / 100.0)

    lat, lon = move_lat_lon(zone["lat"], zone["lon"], direction, length)

    zone_moved = {"lat": lat, "lon": lon, "radius": zone["radius"]}
    return zone_moved


def main():
    parser = argparse.ArgumentParser(description='filters a OpenBikeSensor CSV file')
    parser.add_argument('-i', '--input', required=True, action='store',
                        help='input filename, must be a semicolon-separated text file')
    parser.add_argument('-o', '--output', required=False, action='store',
                        help='output filename, will be the filtered semicolon-separated text file')
    parser.add_argument('-s', '--secret', required=False, action='store', help='secret')
    parser.add_argument('-z', '--zones', action='store', help='filename of privacy zone list')
    parser.add_argument('-a', '--lat', action='append', type=float, default=[],
                        help='latitude of the center of the circle used for filtering, in degree')
    parser.add_argument('-b', '--lon', action='append', type=float, default=[],
                        help='longitude of the center of the circle used for filtering, in degree')
    parser.add_argument('-r', '--radius', action='store', type=float, default=100,
                        help='radius of the circle used for filtering, in meters, default: 100')
    parser.add_argument('-R', '--randofs', action='store', type=float, default=50,
                        help='maximum random displacement of circle center, in percent of radius, default: 50')
    parser.add_argument('-v', '--verbose', action='store_true', help='be verbose')

    args = parser.parse_args()

    coloredlogs.install(level=logging.DEBUG if args.verbose else logging.INFO,
        fmt="%(asctime)s %(name)s %(levelname)s %(message)s")

    if args.randofs != 0 and args.secret is None:
        log.error("Please provide a secret phrase using the -s option, or deactivate "
                  "random offsetting of the zone center using -R 0")
        sys.exit(-1)

    if args.output is None:
        base, ext = os.path.splitext(args.input)
        args.output = base + "_cleaned" + ext

    if not len(args.lat) == len(args.lon):
        log.error("Same number of LAT and LON arguments expected.")
        sys.exit(-1)
    latitude = args.lat
    longitude = args.lon
    radius = [args.radius] * len(latitude)

    # read zone coordinates from zone file
    if args.zones is not None:
        lat, lon, r = read_zones(args.zones)
        latitude += lat
        longitude += lon
        radius += r

    # compose zones
    zones = []

    log.debug("zone list:")
    log.debug("%14s %15s %10s   %15s %15s", "latitude [deg]", "longitude [deg]", "radius [m]", "lat. original", "lon. original")

    for lat, lon, r in zip(latitude, longitude, radius):
        rand_offset = args.randofs

        zone = {"lat": lat, "lon": lon, "radius": r, "rand_offset": rand_offset}

        zone_moved = move_zone(zone, args.secret)

        log.debug("%+14.9f %+15.9f %+10.1f   %+15.9f %+15.9f",
                  zone_moved["lat"], zone_moved["lon"], zone_moved["radius"],
                  zone["lat"], zone["lon"])

        zones.append(zone_moved)

    filter_csv_privacy(args.input, args.output, zones)


if __name__ == "__main__":
    main()
