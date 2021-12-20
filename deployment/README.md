# Deploying an OpenBikeSensor Portal with Docker

## Introduction

The main idea of this document is to provide an easy docker-based
production-ready setup of the openbikesensor portal.  It uses the [the traefik
proxy](https://doc.traefik.io/traefik/) as a reverse proxy, which listens
on port 80 and 443.  Based on some labels, traefik routes the domains to the
corresponding docker containers.

## Before Getting Started

The guide and example configuration assumes one domain, which points to the
server's IP address. This documentation uses `portal.example.com` as an
example. The API is hosted at `https://portal.example.com/api`, while the main
frontend is reachable at the domain root.

## Setup instructions

### Clone the repository

First create a folder somewhere in your system, in the example we use 
`/opt/openbikesensor` and export it as `$ROOT` to more easily refer to it.

Clone the repository to `$ROOT/source`.

```bash
export ROOT=/opt/openbikesensor
mkdir -p $ROOT
cd $ROOT
git clone --recursive https://github.com/openbikesensor/portal source/
# If you accidentally cloned without --recursive, fix it by running:
# git submodule update --init --recursive
```

Unless otherwise mentioned, commands below assume your current working
directory to be `$ROOT`.


### Configure `traefik.toml`

```bash
mkdir -p config/
cp source/deployment/examples/traefik.toml config/traefik.toml
vim config/traefik.toml
```

Configure your email in the `config/traefik.toml`. This email is used by
*Let's Encrypt* to send you some emails regarding your certificates.


### Configure `docker-compose.yaml`

```bash
cp source/deployment/examples/docker-compose.yaml docker-compose.yaml
vim docker-compose.yaml
```

* Change the domain where it occurs, such as in `Host()` rules. 
* Generate a secure password for the PostgreSQL database user. You will need to
  configure this in the application later.


### Create a keycloak instance

Follow the [official guides](https://www.keycloak.org/documentation) to create
your own keycloak server. You can run the keycloak in docker and include it in
your `docker-compose.yaml`, if you like.

Documenting the details of this is out of scope for our project. Please make
sure to configure:

* An admin account for yourself
* A realm for the portal
* A client in that realm with "Access Type" set to "confidential" and a
  redirect URL of this pattern: `https://portal.example.com/login/redirect`


### Prepare database

Follow the procedure outlined in [README.md](../README.md) under "Prepare
database". Whenever the docker-compose service `api` is referenced, replace it
with `portal`, which contains the same python code as the development `api`
service, but also the frontend. For example:

```bash
# development
docker-compose run --rm api tools/prepare_sql_tiles.py
# production
docker-compose run --rm portal tools/prepare_sql_tiles.py
```

### Import OpenStreetMap data

Follow the procedure outlined in [README.md](../README.md) under "Import OpenStreetMap data".


### Configure portal

```bash
cp source/api/config.py.example config/config.py
```

Then edit `config/config.py` to your heart's content (and matching the
configuration of the keycloak). Do not forget to generate a secure secret
string.

Also set `PROXIES_COUNT = 1` in your config, even if that option is not
included in the example file. Read the 
[Sanic docs](https://sanicframework.org/en/guide/advanced/proxy-headers.html) 
for why this needs to be done. If your reverse proxy supports it, you can also
use a forwarded secret to secure your proxy target from spoofing. This is not
required if your application server does not listen on a public interface, but
it is recommended anyway, if possible.

### Build container and run them

```bash
docker-compose build portal
docker-compose up -d portal
```

## Running a dedicated worker

Extend your `docker-compose.yaml` with the following service:

```yaml
  worker:
    image: openbikesensor-portal
    build:
      context: ./source
    volumes:
      - ./data/api-data:/data
      - ./config/config.py:/opt/obs/api/config.py
    restart: on-failure
    links:
      - postgres
    networks:
      - backend
    command:
      - python
      - tools/process_track.py
```

Change the `DEDICATED_WORKER` option in your config to `True` to stop
processing tracks in the portal container. Then restart the `portal` service
and start the `worker` service.

## Miscellaneous

### Logs

To read logs, run

```bash
docker-compose logs -f
```

If something went wrong, you can reconfigure your config files and rerun:

```bash
docker-compose build
docker-compose up -d
```

### Updates

Before updating make sure that you have properly backed-up your instance so you 
can always roll back to a pre-update state.

### Backups

To backup your instances private data you only need to backup the ``$ROOT`` folder.
This should contain everything needed to start your instance again, no persistent
data lives in docker containers. You should stop the containers for a clean backup.

This backup contains the imported OSM data as well. That is of course a lot of
redundant data, but very nice to have for a quick restore operation. If you
want to generate smaller, nonredundant backups, or backups during live
operation of the database, use a tool like `pg_dump` and extract only the
required tables:

* `overtaking_event`
* `track`
* `user` (make sure to reference `public.user`, not the postgres user table)
* `comment`

You might also instead use the `--exclude-table` option to ignore the `road`
table only (adjust connection parameters and names):

```bash
pg_dump -h localhost -d obs -U obs -n public -T road -f backup-`date +%F`.sql
```

Also back up the raw uploaded files, i.e. the `local/api-data/tracks`
directory. The processed data can be regenerated, but you can also back that
up, from `local/api-data/processing-output`.

Finally, make sure to create a backup of your keycloak instance. Refer to the
keycloak documentation for how to export its data in a restorable way. This
should work very well if you are storing keycloak data in the PostgreSQL and
exporting that with an exclusion pattern instead of an explicit list.

And then, please test your backup and restore strategy before going live, or at
least before you need it!
