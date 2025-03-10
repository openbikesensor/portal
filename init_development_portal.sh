#!/bin/bash
if [[ -f `which docker-compose` ]]
then
export COMPOSE=`which docker-compose`
else
export COMPOSE=`which docker`\ compose
fi
echo using docker compose command $COMPOSE

if [[ `$COMPOSE ps|wc -l` -gt 1 ]]
then
  echo "there are already containers running for this folder name. Either you have a different development setup active in the same folder name, or you have already initialized from this folder - aborting to not break stuff."
  echo "this is the output of $COMPOSE ps:"
  echo ""
  $COMPOSE ps
  echo ""
  echo "it should show the containers in question"
  echo "you likely will only want to run one development setup on any given machine without modifications."
  echo "if these are indeed leftovers of a previous attempt remove preexisting containers or retry with a fresh checkout with a different directory name."
  exit 1
fi
set -e
mkdir -p local
if mkdir local/keycloak
then
  echo initializing keycloak and creating api/config.overrides.py
  chmod -R a+rwX local/keycloak
  $COMPOSE up -d keycloak
  echo "waiting 120s for keycloak start"
  sleep 120
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
sleep 10
echo "congrats, you now have the development portal running. Here's what we started"
echo ""
$COMPOSE ps
