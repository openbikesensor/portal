# Upgrading

This document describes the general steps to upgrade between major changes.
Simple migrations, e.g. for adding schema changes, are not documented
explicitly. Once we implement them, their usage will be described in the
[README](./README.md).


## v0.2 to v0.3 (MongoDB to PostgreSQL)

* Shut down all services
* Obviously, now is a good time to perform a full backup ;)
* Update the codebase (`git pull`, `git submodule update`).
* Update your ``docker-compose.yaml`` from the ``deployment/examples`` folder.
  * Leave the MongoDB service in place for now
  * but update all other service descriptions. 
  * You can remove  `redis` already. Generate a better password than the default for your
    postgres user. Traefik rules have been simplified as all routes are handled
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
* Consider configuring a worker service. See [deployment/README.md](deployment/README.md).

