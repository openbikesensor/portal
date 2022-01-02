#!/bin/bash

osm2pgsql --create --hstore --style tools/roads_import.lua -O flex -d postgresql://$OBS_POSTGRES_USER:$OBS_POSTGRES_PASSWORD@$OBS_POSTGRES_HOST/$OBS_POSTGRES_DB /pbf/*.osm.pbf

