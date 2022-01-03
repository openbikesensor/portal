# Deploying an OpenBikeSensor Portal with Docker

## Introduction

The main idea of this document is to provide an easy docker-based
production-ready setup of the openbikesensor portal.  It uses the [the traefik
proxy](https://doc.traefik.io/traefik/) as a reverse proxy, which listens
on port 80 and 443.  Based on some labels, traefik routes the domains to the
corresponding docker containers.

## Requirements

This guide requires a Linux-system, where `docker` and `docker-compose` are installed.
Ensure, that your system is up to date.

## Before Getting Started

The example configurations assume two domains, which points to the
server's IP address. This documentation uses `portal.example.com` and
`login.example.com`. The API is hosted at `https://portal.example.com/api`, 
while the main frontend is reachable at the domain root.

## Setup instructions

First of all, login into your system via SSH.

### Create working directory

Create a folder somewhere in your system, in this guide we use 
`/opt/openbikesensor`.

### Clone the repository

Clone the repository to `/opt/openbikesensor/`:

```bash
cd /opt/openbikesensor/
git clone --recursive https://github.com/openbikesensor/portal source/
# If you accidentally cloned without --recursive, fix it by running:
# git submodule update --init --recursive
```

### Copy predefined configuration files

```bash
mkdir -p /opt/openbikesensor/config
cd /opt/openbikesensor/

cp source/deployment/examples/docker-compose.yaml docker-compose.yaml
cp source/deployment/examples/.env .env

cp source/deployment/examples/traefik.toml config/traefik.toml
cp source/deployment/examples/config.py config/config.py
```

### Create a Docker network

```bash
docker network create gateway
```

### Traefik

#### Configure `traefik.toml`

```bash
cd /opt/openbikesensor/
nano config/traefik.toml
```

Configure your email in the `config/traefik.toml`. This email is used by
*Let's Encrypt* to send you some emails regarding your certificates.

#### Start Traefik

```bash
docker-compose up -d traefik
docker-compose logs -f traefik
```

### Generate passwords

Generate three passords, for example with `pwgen`:

```bash
pwgen -2 -n 20
```

They will be uses in the next steps.

### KeyCloak

#### Configure `.env`

```bash
cd /opt/openbikesensor/
nano .env
```

Configure:
* `OBS_KEYCLOAK_URI`:
    * The subdomain of your keycloak
* `OBS_KEYCLOAK_POSTGRES_PASSWORD` and `OBS_KEYCLOAK_ADMIN_PASSWORD`:
    * One of the generated passwords for the KeyCloak-postgres
* `OBS_KEYCLOAK_PORTAL_REDIRECT_URI`:
    * The Redirect URI, e.g. the subdomain of your portal (ensure, it ends with `/*`)

Wait until postgres and keycloak are started:

* https://login.dennisboldt.de/

#### Configure Realm and Client

Login into your KeyCloak:

```bash
docker-compose exec keycloak /bin/bash
```

Since we configured the `.env`-file we can run the following commands
to create a realm and a client now:

```bash
# Login
/opt/jboss/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080/auth --realm master --user $KEYCLOAK_USER --password $KEYCLOAK_PASSWORD

# Create Realm
/opt/jboss/keycloak/bin/kcadm.sh create realms -s realm=$OBS_KEYCLOAK_REALM -s enabled=true -o

# Create a client and remember the unique id of the client
CID=$(/opt/jboss/keycloak/bin/kcadm.sh create clients -r $OBS_KEYCLOAK_REALM -s clientId=portal -s "redirectUris=[\"$OBS_KEYCLOAK_PORTAL_REDIRECT_URI\"]" -i)

# Create a secret for the client
/opt/jboss/keycloak/bin/kcadm.sh create clients/$CID/client-secret -r $OBS_KEYCLOAK_REALM

# Get the secret of the client
/opt/jboss/keycloak/bin/kcadm.sh get clients/$CID/client-secret -r $OBS_KEYCLOAK_REALM

exit
```

Now, configure the client secret:

```bash
cd /opt/openbikesensor/
nano .env
```

Configure:
* `OBS_KEYCLOAK_CLIENT_SECRET`:
    *  Use the obtained client secret

#### Create a user

* Login into your Keycloak with the admin user and select the realm obs
* Create a user with username and email (*Hint*: email is required by the portal)
* Configure a password as well

### Portal

#### Configure Postgres

```bash
cd /opt/openbikesensor/
nano .env
```

Configure:

* `OBS_POSTGRES_HOST`:
    * The should be the postgres-container, e.g. `postgres`
* `OBS_POSTGRES_USER`:
    * The default postgres-user is `obs`
* `OBS_POSTGRES_PASSWORD`:
    * Use one of the generated passwords for the postgres
* `OBS_POSTGRES_DB`:
    * The default postgres-database is `obs`
* `OBS_POSTGRES_URL`:
    * Use the same informations as aboe to configure the `POSTGRES_URL`, 
      this one is used by the portal.

#### Start Postgres for the portal

```
cd /opt/openbikesensor/
docker-compose up -d postgres
docker-compose logs -f
```

#### Build the portal image

```bash
cd /opt/openbikesensor/
docker-compose build portal
```

*Hint*: This may take up to 10 minutes. In the future, we will provide a prebuild image.

#### Download OpenStreetMap maps

Download the area(s) you would like to import from 
[GeoFabrik](https://download.geofabrik.de) into `data/pbf`, for example:

```bash
cd /opt/openbikesensor/
wget https://download.geofabrik.de/europe/germany/schleswig-holstein-latest.osm.pbf -P data/pbf
```

*Hint*: Start with a small region/city, since the import can take some hours for huge areas.

#### Prepare database

Run the following scripts to prepare the database:

```bash
docker-compose run --rm portal tools/reset_database.py
docker-compose run --rm portal tools/prepare_sql_tiles.py
```

For more details, see [README.md](../README.md) under "Prepare database".

#### Import OpenStreetMap data

Run the following script, to import the OSM data:

```
docker-compose run --rm portal tools/osm2pgsql.sh
```

For more details. see [README.md](../README.md) under "Import OpenStreetMap data".


#### Configure portal

The portal can be configured via env-vars or via the `config.py`. 
It's important to know, that the `config.py` overrides the env-vars.
All env-vars start with `OBS_` and will be handled by the application without the prefix.
For example, the env-var `OBS_SECRET` will be same as `SECRET` within the `config.py` and will be `SECRET` within the application.

```bash
cd /opt/openbikesensor/
nano .env
```

Configure:

* `OBS_PORTAL_URI`:
    * The subdomain of your portal
* `OBS_SECRET`:
    * Generate a UUID with `uuidgen` and use it as the secret
* `OBS_POSTGRES_URL`:
    * Should be configured already
* `OBS_KEYCLOAK_URL`:
    * You can find it as the `issuer`, when you click on *OpenID Endpoint Configuration* in the realm obs
* `OBS_KEYCLOAK_CLIENT_SECRET`:
    * Should be configured already
* `OBS: DEDICATED_WORKER`
    * Should be set to `"True"`, since it the workder will be started with the portal
* `OBS_DATA_DIR`
    * The data dir must be the same for the portal and the worer. 
      The default is `/data` within the containers
* `OBS_PROXIES_COUNT`:
    * This sets `PROXIES_COUNT = 1` in your config
    * Read the [Sanic docs](https://sanicframework.org/en/guide/advanced/proxy-headers.html) 
      for why this needs to be done. If your reverse proxy supports it, you can also
      use a forwarded secret to secure your proxy target from spoofing. This is not
      required if your application server does not listen on a public interface, but
      it is recommended anyway, if possible.

Have a look into the `config.py`, which other variables may affect you.

#### Start the portal

```bash
cd /opt/openbikesensor/
docker-compose up -d portal
```

This also starts a dedicated worker container to handle the tracks.

#### Test the portal

* Open: https://obs.example.com/
* Login with the user
* Upload a track

You should see smth. like:

> worker_1    | INFO: Track 10b9ulou imported.

#### Configre the map position

Open the tab *Map** an zoom to the desired position. The URL contains the corresponding GPS position,
for example:

> 14/53.86449349032097/10.696108517499198

Configure the map position in the `config.py` and restart the portal:

```
cd /opt/openbikesensor/
nano config/config.py 

docker-compose restart portal
```

The tab *Map* should be the selected map section now.

**Hint**: Probably it's required to disable the browser cache to see the change.

#### Verify osm2pgsql

If you zoom in the tab *Map* at the imported region/city, you should see dark grey lines on the streets.

## Miscellaneous

### Logs

To read the logs, run

```bash
docker-compose logs -f
```

If something went wrong, you can reconfigure your config files and rerun:

```bash
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
