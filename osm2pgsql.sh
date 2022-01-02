#!/bin/bash

echo $POSTGRES_PASSWORD | osm2pgsql --create --hstore --style tools/roads_import.lua -O flex -H $POSTGRES_HOST -d $POSTGRES_DB -U $POSTGRES_USER -W /pbf/*.osm.pbf
