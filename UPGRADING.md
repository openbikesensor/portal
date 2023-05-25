# Upgrading
This document describes the general steps to upgrade between major changes.
Simple migrations, e.g. for adding schema changes, are not documented
explicitly. Their general usage is described in the [README](./README.md) (for
development) and [docs/production-deployment.md](docs/production-deployment.md) (for production).


## 0.8.0
Upgrade to `0.7.x` first. See below for details. Then follow these steps:

> **Warning** The update includes a reprocessing of tracks after import. Depending on the number of tracks this can take a few hours. The portal is reachable during that time but events disappear and incrementally reappear during reimport.

> **Info** With this version the Import process for OpenStreetMap data has changed: the [new process](docs/osm-import.md) is easier on resources and finally permits to import a full country on a low-end VM.

- Do your [usual backup](docs/production-deployment.md)
- Rebuild images
- Stop your portal and worker services
- run upgrade
  ```bash
  docker-compose run --rm portal tools/upgrade.py
  ```
  this automatically does the following
  - Migration of database schema using alembic.
  - Upgrade of SQL tile schema to new schema.
  - Import the nuts-regions from the web into the database.
  - Trigger a re-import of all tracks.
- Start your portal and worker services.


## 0.7.0

Upgrade to `0.6.x` first. See below for details. Then follow these steps:

- Rebuild images
- Stop your portal and worker services.
- **Migration with alembic**: required 
- **Prepare SQL Tiles**: required
- Start your portal and worker services.
- **Reimport tracks**: no action required 
- **OSM Import**: required
- **Config changes**: add `POSTGRES_MAX_OVERFLOW` and `POSTGRES_POOL_SIZE`
  variables, see `api/config.py.example`  

## 0.6.0

**Make sure to upgrade to `0.5.1` first, by checking out that version tag and
running migrations, then coming back to this version.** This is required
because the migrations have been edited to create the initial database schema,
but if you run the 0.5.1 migrations first, your database will remember that it
already has all the tables created. This is not required if you set up a new
installation.

For this update, run these steps:

- Build new images
- Stop portal and worker services
- Run the new upgrade tool:
  ```bash
  docker-compose run --rm portal tools/upgrade.py
  ```
- Start portal and worker services

## 0.5.0

The upgrade requires the following steps in the given order

- Rebuild images
- Stop your portal and worker services.
- **Migration with alembic**: required 
- **Prepare SQL Tiles**: required 
- Start your portal and worker services.
- **Reimport tracks**: required 
- **OSM Import**: no action required
- **Config changes**: none

## 0.4.1

You can, but do not have to, reimport all tracks. This will generate a GPX file
for each track and allow the users to download those. If a GPX file has not yet
been created, the download will fail. To reimport all tracks, log in to your
PostgreSQL database (instructions are in [README.md](./README.md) for
development and [docs/production-deployment.md](./docs/production-deployment.md) for production)
and run:

```sql
UPDATE track SET processing_status = 'queued';
```

You can do this selectively with `WHERE` statements.

Make sure your worker is running to process the queue.

## 0.4.0

* Rebuild your image, this may take longer than usual, as it will compile
  `osm2pgsql` for you. Next time, it should be in your docker build cache and
  be fast again.
* Add new config flags: `VERBOSE`, `LEAN_MODE`, `POSTGRES_POOL_SIZE`,
  `POSTGRES_MAX_OVERFLOW`. Check the example config for sane default values.
* Re-run `tools/prepare_sql_tiles.py` again (see README)
* It has been made easier to import OSM data, check
  [docs/production-deployment.md](./docs/production-deployment.md) for the sections "Download
  OpenStreetMap maps" and "Import OpenStreetMap data". You can now download
  multiple .pbf files and then import them at once, using the docker image
  built with the `Dockerfile`. Alternatively, you can choose to enable [lean
  mode](docs/lean-mode.md). You do not need to reimport data, but setting this
  up now will make your life easier in the long run ;)

## v0.2 to v0.3 (MongoDB to PostgreSQL)

* Shut down all services
* Obviously, now is a good time to perform a full backup ;)
* Update the codebase (`git pull`, `git submodule update`).
* Update your ``docker-compose.yaml`` with the one from the ``deployment/examples`` 
  folder.
  * Leave the MongoDB service in place for now.
  * Update all other service descriptions. 
  * You can remove `redis` already. 
  * Generate a better password than the default for your
    postgres user.
  * Traefik rules have been simplified as all routes are handled
    by the portal service now.
* Start up the `mongo` and `postgres` services. Wait for postgres to finish
  initializing (see [README](README.md)).
* Build the new image (e.g. with `docker-compose build portal`)
* Configure your API. The example config file is `api/config.py.example`, and
  it will need to be mounted to `api/config.py` in the container. Ignore the
  Keycloak options for now.
* Prepare the database: 
  
    ```bash
    docker-compose run --rm portal python tools/reset_database.py
    docker-compose run --rm portal python tools/prepare_sql_tiles.py
    ```
* Import OSM data (see [README](README.md)).
* Run the database migration script: 
    
    ```bash
    docker-compose run --rm \
        -v $PWD/export:/export \
        portal \
        python tools/import_from_mongodb.py mongodb://mongo/obs \
        --keycloak-users-file /export/users.json
    ```
  There is an option `--keep-api-keys` which means the users won't have to
  reconfigure the devices they used their API key in. **However**, please try
  to avoid this option if at all possible, as the old keys are *very* insecure.
  The default without this option to generate a new, secure API key for each
  user.
* Shut down the `mongo` service, you can now remove it from docker-compose.yaml
* Start `keycloak` and configure it, similarly to how it was configured in the
  development setup (but choose more secure options). Update the API config
  file to match your keycloak configuration. Import the file
  `export/users.json` into your realm, it will re-add all the users from the
  old installation. You should delete the file and `export/` folder afterwards.
* Start `portal`.
* Consider configuring a worker service. See [docs/production-deployment.md](./docs/production-deployment.md).

