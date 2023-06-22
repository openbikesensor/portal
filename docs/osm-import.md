# Importing OpenStreetMap data

The application requires a lot of data from the OpenStreetMap to work.

The required information is stored in the PostgreSQL database and used when
processing tracks, as well as for vector tile generation. The process applies
to both development and production setups. For development, you should choose a
small area for testing, such as your local county or city, to keep the amount
of data small. For production use you have to import the whole region you are
serving.

## General pipeline overview

1. Download OpenStreetMap data as one or more `.osm.pbf` files.
2. Transform this data to generate geometry data for all roads and regions, so
   we don't need to look up nodes separately. This step requires a lot of CPU
   and memory, so it can be done "offline" on a high power machine.
3. Import the transformed data into the PostgreSQL/PostGIS database.

## Community hosted transformed data

Since the first two steps are the same for everybody, the community will soon
provide a service where relatively up-to-date transformed data can be
downloaded for direct import. Stay tuned.

## Download data

[GeoFabrik](https://download.geofabrik.de) kindly hosts extracts of the
OpenStreetMap planet by region. Download all regions you're interested in from
there in `.osm.pbf` format, with the tool of your choice, e. g.:

```bash
wget -P local/pbf/ https://download.geofabrik.de/europe/germany/baden-wuerttemberg-latest.osm.pbf 
```

## Transform data

To transform downloaded data, you can either use the docker image from a
development or production environment, or locally install the API into your
python environment. Then run the `api/tools/transform_osm.py` script on the data.

```bash
api/tools/transform_osm.py baden-wuerttemberg-latest.osm.pbf baden-wuerttemberg-latest.msgpack
```

In dockerized setups, make sure to mount your data somewhere in the container
and also mount a directory where the result can be written. The development
setup takes care of this, so you can use:

```bash
docker-compose run --rm api tools/transform_osm.py \
  /pbf/baden-wuerttemberg-latest.osm.pbf /obsdata/baden-wuerttemberg-latest.msgpack
```

Repeat this command for every file you want to transform.

## Import transformed data

The command for importing looks like this:

```bash
api/tools/import_osm.py baden-wuerttemberg-latest.msgpack
```

This tool reads your application config from `config.py`, so set that up first
as if you were setting up your application.

In dockerized setups, make sure to mount your data somewhere in the container.
Again, the development setup takes care of this, so you can use:

```bash
docker-compose run --rm api tools/import_osm.py \
  /obsdata/baden-wuerttemberg-latest.msgpack
```

The transform process should take a few seconds to minutes, depending on the area
size. You can run the process multiple times, with the same or different area
files, to import or update the data. You can update only one region and leave
the others as they are, or add more filenames to the command line to
bulk-import data.

## How this works

* The transformation is done with a python script that uses
  [pyosmium](https://osmcode.org/pyosmium/) to read the `.osm.pbf` file. This
  script then filters the data for only the required objects (such as road
  segments and administrative areas), and extracts the interesting information
  from those objects.
* The node geolocations are looked up to generate a geometry for each object.
  This requires a lot of memory to run efficiently.
* The geometry is projected to [Web Mercator](https://epsg.io/3857) in this
  step to avoid continous transformation when tiles are generated later. Most
  operations will work fine in this projection. Projection is done with the
  [pyproj](https://pypi.org/project/pyproj/) library.
* The output is written to a binary file in a very simple format using
  [msgpack](https://github.com/msgpack/msgpack-python), which is way more
  efficient that (Geo-)JSON for example. This format is stremable, so the
  generated file is never fully written or read into memory.
* The import script reads the msgpack file and sends it to the database using
  [psycopg](https://www.psycopg.org/). This is done because it supports
  PostgreSQL's `COPY FROM` statement, which enables much faster writes to the
  database that a traditionional `INSERT VALUES`. The file is streamed directly
  to the database, so it is never read into memory.
