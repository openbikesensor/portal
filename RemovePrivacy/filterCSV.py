#!/usr/bin/python

import sys
import getopt
import csv
import math
import random
from haversine import haversine, Unit

def filter_csv_privacy(input, output, filter, verbose=False):
    with open(input) as file_in:
        reader = csv.reader(file_in, delimiter=';')

        with open(output, 'w') as file_out:
            writer = csv.writer(file_out, delimiter=';')

            line_count = 0
            filter_count = 0
            data_count = 0
            for line in reader:
                line_count += 1
                keep_line = True
                if line_count == 1:
                    if "Latitude" in line and "Longitude" in line:
                        ix_lat = line.index("Latitude")
                        ix_lon = line.index("Longitude")
                    else:
                        raise ValueError("header line does not contain 'Longitude' and 'Latitude' fields")
                else:
                    data_count += 1
                    lon = float(line[ix_lon])
                    lat = float(line[ix_lat])

                    for f in filter:
                        d = haversine((lat, lon),
                                      (f["lat"], f["lon"]), unit=Unit.METERS)
                        if d <= f["radius"]:
                            if verbose:
                                print("deleting measurement at {} {}, distance to {} {} is {} and below limit of {}"\
                                      .format(lat, lon, f["lat"], f["lon"], d, f["radius"] ))
                            keep_line = False
                            filter_count += 1

                if keep_line:
                    writer.writerow(line)

        if verbose:
            print("filtered {} data lines, removed {} lines".format(data_count, filter_count))


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


def main(argv):
    short_options = "ha:b:r:R:i:o:v"
    long_options = ["help", "lat=", "lon=", "radius=", "randofs=", "input=", "output=", "verbose"]
    try:
        arguments, values = getopt.getopt(argv, short_options, long_options)
    except getopt.error as err:
        # Output error, and return with an error code
        print(str(err))
        sys.exit(2)

    lat = None
    lon = None
    radius = 100
    rand_offset = 50
    filename_out = None
    filename_in = None
    verbose = False
    show_help = False

    for arg, value in arguments:
        if arg in ("-h", "--help"):
            show_help = True
        elif arg in ("-a", "--lat"):
            lat = float(value)
        elif arg in ("-b", "--lon"):
            lon = float(value)
        elif arg in ("-r", "--radius"):
            radius = float(value)
        elif arg in ("-R", "--randofs"):
            rand_offset = float(value)
        elif arg in ("-i", "--input"):
            filename_in = value
        elif arg in ("-o", "--output"):
            filename_out = value
        elif arg in ("-v", "--verbose"):
            verbose = True

    show_help = show_help or lat is None or lon is None or filename_in is None or filename_out is None
    if show_help:
        print("help")
        print("Reads a CSV file, and remove all lines with coordinates close to a given coordinate.")
        print("--help -h                   this help")
        print("--verbose -v                be verbose")
        print("--input=<filename>          input filename, must be semicolon-separated text file")
        print("-i <filename>")
        print("--output=<filename>         output filename, will be the filtered semicolon-separated text file")
        print("-o <filename>")
        print("--lat=<decimal number>      latitude of the center of the circle used for filtering, in degree")
        print("-a <decimal number>")
        print("--lon=<decimal number>      longitude of the center of the circle used for filtering, in degree")
        print("-b <decimal number>")
        print("--radius=<decimal number>   radius of the circle used for filtering, in meters, default: 100")
        print("-r <decimal number>")
        print("--randofs=<decimal number>  maximum random displacement of circle center, in percent of radius, default: 50")
        print("-o <decimal number>")
        print("Example: python filterCSV.py -i input.csv -o output.csv --lat=1.2345 --lon=-12.3456 --radius=200 --randofs=50")
        sys.exit(0)

    if rand_offset is not 0.0:
        lat_moved, lon_moved = move_lat_lon(lat, lon,
                                            random.uniform(0.0, 360.0),
                                            random.uniform(0.0, radius*rand_offset/100.0))
        if verbose:
            print("added random offset: moved {} {} to {} {}".format(lat, lon, lat_moved, lon_moved))

        lat, lon = lat_moved, lon_moved

    filter = [{"lat": lat, "lon": lon, "radius": radius, "rand_offset": rand_offset}]
    filter_csv_privacy(filename_in, filename_out, filter, verbose)


if __name__ == "__main__":
    main(sys.argv[1:])
