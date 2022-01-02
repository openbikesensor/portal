#!/bin/bash

osm2pgsql --create --hstore --style tools/roads_import.lua -O flex -d postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST/$POSTGRES_DB /pbf/*.osm.pbf

