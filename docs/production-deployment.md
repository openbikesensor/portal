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

> TODO

```bash
apt install docker.io docker-compose pwgen
```

## Before Getting Started

The example configurations assume two domains, which points to the
server's IP address. This documentation uses `portal.example.com` and
`login.example.com`. The API is hosted at `https://portal.example.com/api`, 
while the main frontend is reachable at the domain root.

## Setup instructions

First of all, login into your system via SSH.

### Create working directory

Create a folder somewhere in your system, in this guide we use 
`/opt/openbikesensor`:

```bash
mkdir /opt/openbikesensor
```

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
cp -r source/deployment/config source/deployment/docker-compose.yaml source/deployment/.env .
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
cd /opt/openbikesensor/
docker-compose up -d traefik
docker-compose logs -f traefik
```

> traefik_1            | time="2022-01-03T13:02:36Z" level=info msg="Configuration loaded from file: /traefik.toml"

### Generate passwords

Generate three passords, for example with `pwgen`:

```bash
pwgen -n 20
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
* `OBS_KEYCLOAK_POSTGRES_PASSWORD`
    * One of the generated passwords for the KeyCloak-postgres
* `OBS_KEYCLOAK_ADMIN_PASSWORD`:
    * One of the generated passwords for the KeyCloak-admin
* `OBS_KEYCLOAK_PORTAL_REDIRECT_URI`:
    * The Redirect URI, e.g. the subdomain of your portal (ensure, it ends with `/*`)

#### Start KeyCloak

```bash
docker-compose up -d keycloak
docker-compose logs -f keycloak
```

Wait until postgres and keycloak are started:

> keycloak_1           | 13:08:55,558 INFO  [org.jboss.as] (Controller Boot Thread) WFLYSRV0051: Admin console listening on http://127.0.0.1:9990

Open:

* https://login.example.com/
* Test login to the admin console with your admin account

#### Configure Realm and Client

Jump into the KeyCloak container:

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
```

Exit the container with `exit`. Configure the client secret:

```bash
cd /opt/openbikesensor/
nano .env
```

Configure:
* `OBS_KEYCLOAK_CLIENT_SECRET`:
    *  Use the obtained client secret

#### Create a user

* Login into your Keycloak with the admin user and select the realm obs
* Create a user with username and email for the realm `obs` (*Hint*: email is required by the portal)
* Configure a password in the tab `Credentials` as well

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
docker-compose logs -f postgres
```
Wait until started:

> postgres_1           | PostgreSQL init process complete; ready for start up.


#### Build the portal image

```bash
cd /opt/openbikesensor/
docker-compose build portal
```

*Hint*: This may take up to 10 minutes. In the future, we will provide a prebuild image.

#### Prepare database

Run the following scripts to prepare the database:

```bash
docker-compose run --rm portal tools/upgrade.py
```

For more details, see [README.md](../README.md) under "Prepare database".

#### Import OpenStreetMap data

Follow [these instructions](./osm-import.md).


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
docker-compose logs -f portal worker
```

> portal_1             | [2022-01-03 13:37:48 +0000] [1] [INFO] Goin' Fast @ http://0.0.0.0:3000

This also starts a dedicated worker container to handle the tracks.

#### Test the portal

* Open: https://portal.example.com/ (URL depends on your setup)
* Login with the user
* Upload a track via My Tracks

You should see smth. like:

> worker_1             | INFO: Track uuqvcvlm imported.

When you click on *My Tracks*, you should see it on a map.

#### Configre the map position

Open the tab *Map** an zoom to the desired position. The URL contains the corresponding GPS position,
for example:

> 14/53.86449349032097/10.696108517499198

Configure the map position in the `config.py` and restart the portal, by setting `mapHome` in the variable `FRONTEND_CONFIG`:

```
cd /opt/openbikesensor/
nano config/config.py 

docker-compose restart portal
```

**Hint**: Maybe it's required to disable the browser cache to see the change.

The tab *Map* should be the selected map section now.
When you uploaded some tracks, you map should show a colors overlay on the streets.

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

#### Migrating

Migrations are done with
[Alembic](https://alembic.sqlalchemy.org/en/latest/index.html), please refer to
its documentation for help. Most of the time, running this command will do all
the migrations you need:

```bash
docker-compose run --rm portal alembic upgrade head
```

You are advised to create a backup (see below) before running a migration, and
to shut down the services before the migration and start them afterwards.

### Backups

To backup your instances private data you only need to backup the ``$ROOT`` folder.
This should contain everything needed to start your instance again, no persistent
data lives in docker containers. You should stop the containers for a clean backup.

This backup contains the imported OSM data as well. That is of course a lot of
redundant data, but very nice to have for a quick restore operation. If you
want to generate smaller, nonredundant backups, or backups during live
operation of the database, use a tool like `pg_dump` and extract only the
required tables:

* `road_usage`
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


### Connecting to the PostgreSQL database

Here are the quick steps for connecting to your PostgreSQL database, should you
need that:

* Add the `gateway` network to your `postgres` service.
* Add a port forwarding to your `postgres` service:
  ```yaml
     ports:
       - 127.0.0.1:25432:5432
  ```
* Run `docker-compose up -d postgres` again
* You can now connect from your server to the PostgreSQL service with:

  ```
  psql -h localhost -U obs -d obs -p 25432
  ```
  
  You will need your database password for the connection.
* If you do not want to install `psql` outside your container, you can use an
  SSH tunnel from your local machine to your server and run `psql` locally.
