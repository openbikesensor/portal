# Tile Generation

To display the collected data we generate vector tiles which can be rendered by
different map renderers, such  as
[maplibre-gl-js](https://github.com/MapLibre/maplibre-gl-js) or
[QGIS](https://www.qgis.org/en/site/).

The whole process requires a dockerized setup. Of course you can try to install
and run the tools without docker, but that is probably going to be very
complicated, and we're not documenting it here.

## Data sources

There are two main sources of data. Both feed into a PostgreSQL database into
separate tables, such that they can be joined for processing.

### Application data

The **API** imports tracks separately and stores the imported data into the
`overtaking_event` table. This is already part of the application and does not
need configuration, apart from specifying the correct `postgres.url` in the API
config.

### Importing OpenStreetMap data

This is the road information imported from OpenStreetMap itself. Download the
area(s) you would like to import from
[GeoFabrik](https://download.geofabrik.de). Then import the files like this:

```bash
osm2pgsql --create --hstore --style api/roads_import.lua -O flex \
  -H localhost -d obs -U obs -W \
  path/to/downloaded/myarea-latest.osm.pbf 
```

You might need to adjust the host, database and username (`-H`, `-d`, `-U`) to
your setup, and also provide the correct password when queried. This process
should take a few seconds to minutes, depending on the area size. You can run
the process multiple times, with the same or different area files, to import or
update the data. You can also truncate the `road` table before importing if you
want to remove outdated road information.

## Configure

Edit the file `tile-generator/.env` and adjust the following variables:

* `PGDATABASE, PGUSER, ...` if you have different PostgreSQL credentials
* `BBOX`, a bounding box for the area you want to generate (keep it small). Use
  [this tool](https://boundingbox.klokantech.com/) to draw an area on a map.

## Generate SQL functions

The [OpenMapTiles](https://openmaptiles.org/) project is used to generate the
vector tiles. For this, a lot of logic is generated and imported into the
PostgreSQL database in the form of user functions. To generate and import these, run::

```bash
cd tile-generator/
make clean
make
make import-sql
```

## Generate `.mbtiles` file

This file contains all the vector tiles for the selected area and zoom levels,
and different layers of information (according to the layer descriptions in
`tile-generator/layers/` and `tile-generator/openmaptiles.yaml`). It is
generated like this:

```bash
make generate-tiles-pg
```

## Publish vector tiles

The tool [tileserver-gl](http://tileserver.org/) is used to publish the vector
tiles separately through HTTP. The tileserver runs inside docker, so all you need to do for a development setup is start it:

```
docker compose up -d tileserver
```

It is now available at [http://localhost:3002/](http://localhost:3002/).
