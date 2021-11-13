# Upgrading

This document describes the general steps to upgrade between major changes.
Simple migrations, e.g. for adding schema changes, are not documented
explicitly. Once we implement them, their usage will be described in the
[README](./README.md).


## v0.2 to v0.3 (MongoDB to PostgreSQL)

* Shut down all services
* Obviously, now is a good time to perform a full backup ;)
* Update the codebase
* Update docker-compose.yaml from the example. Leave the MongoDB service in
  place for now, but update all other service descriptions. You can remove
  `redis` already.
* Start up the `mongo` and `postgres` services
* Build the new images (e.g. with `docker-compose build`)
* Configure your API. The example config file is `api/config.py.example`, and
  it will need to be mounted to `api/config.py` in the container. Ignore the
  Keycloak options for now.
* Run the database reset script: `docker-compose run --rm api python tools/reset_database.py`
* Run the database migration script: `docker-compose run --rm api python
  tools/import_from_mongodb.py mongodb://mongo/obs`. You might need to adjust
  the URL.
* Shut down the `mongo` service, you can now remove it from docker-compose.yaml
* Start `keycloak` and configure it, similarly to how it was configured in the
  development setup (but choose more secure options). Update the API config
  file to match your keycloak configuration.
* Start `api`, `worker` and `frontend`

