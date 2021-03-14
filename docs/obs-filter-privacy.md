# obs-filter-privacy

This command filters a CSV file as written by the OpenBikeSensor hardware for
privacy zones.

Each circular privacy zone is defined by the latitude and longitude of its
center, as well as radius.  The center is further displaced to obscure the true
position of the zone center.

## Installation

Please refer to the general [Installation Instructions](../README.md).

## Create a Privacy Zone File

Create a file with contents like the following. The columns are Latitude,
Longitude, Radius in Meters, and an optional name.

```csv
49.12345;9.87645;200;Home
```

## Basic usage

```bash
obs-filter-privacy -i input.csv -o output.csv -z privacy-zones.txt -s SECRET 
```

Make sure to replace "SECRET" by a string just known to you. Use the same
secret every time, to produce the same displacement. If you do not want to
have your privacy zone centers be displaced (e.g. because you already manually
chose displaced zone centers), add the argument `-R 0`.

### Filtering all files in a directory

```bash
for file in obsfiles/*.csv; do 
  obs-filter-privacy -i "${file}" -z privacyzones.txt -s SECRET -v
done
```
 
### All options
    
```bash
obs-filter-privacy --help
```
