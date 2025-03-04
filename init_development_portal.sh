#!/bin/bash
if [[ -f `which docker-compose` ]]
then
export COMPOSE=`which docker-compose`
else
export COMPOSE=`which docker`\ compose
fi
echo using docker compose command $COMPOSE

set -e
mkdir -p local
if mkdir local/keycloak
then
  echo initializing keycloak and creating api/config.overrides.py
  chmod -R a+rwX local/keycloak
  $COMPOSE up -d keycloak
  sleep 40
  echo -n "KEYCLOAK_CLIENT_SECRET=" >api/config.overrides.py
  $COMPOSE exec keycloak /prepare_obs_realm.sh | tail -n1 >>api/config.overrides.py
else
  echo keycloak data dir already exists, skipping keycloak init
fi
if mkdir local/postgres
then
  echo initializing database
  chmod -R a+rwX local/postgres
  $COMPOSE up -d postgres
  sleep 100
  $COMPOSE run --rm api tools/upgrade.py
else
echo "postgres datadir already exists, skipping database init"
fi
echo starting portal
$COMPOSE up -d
