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

## Steps

### Clone the repo

First create a folder somewhere in your system, in the example we use 
`/opt/openbikesensor` and export it as `$ROOT` to more easily refer to it.

Clone the repository to `$ROOT/source`.

```bash
export ROOT=/opt/openbikesensor
mkdir -p $ROOT
cd $ROOT
git clone --recursive https://github.com/openbikesensor/portal source/
# ... or if you accidentally cloned non --recursive, to fix it run:
# git submodule update --init --recursive
```

Unles otherwise mentioned, commandlines below assume your `cwd` to be `$ROOT`

### Configure `traefik.toml`

```bash
mkdir -p config/
cp source/deployment/examples/traefik.toml config/traefik.toml
vim config/traefik.toml
```

Configure your email in the `config/traefik.toml`. This email is uses by
Let's Encrypt to send you some mails regarding your certificates.

### Configure `docker-compose.yaml`

```bash
cp source/deployment/examples/docker-compose.yaml docker-compose.yaml
vim docker-compose.yaml
```

Change the domain where it occurs, such as in `Host()` rules.

### Configure frontend

```bash
cp source/frontend/config.example.json config/frontend.json
vim frontend/src/config.json
```

* Change all URLs to your domain
* Create a UUID by using `uuidgen` and set the `clientId`
* Change the coordinates of the map center to your liking

### Configure API

```bash
cp source/api/config.json.example config/api.json
vim config/api.json
```

* Change all URLs to your domain
* Generate and set a random `cookieSecret` (for example with `uuidgen`)
* Generate and set a random `jwtSecret` (for example with `uuidgen`)
* Configure you SMTP mail server
* Set the `clientId` for the `oAuth2Client` of the portal (from step 3)

### Build container and run them

```bash
docker-compose up -d
```

The services are being built the first time this is run. It can take some
minutes.


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

#### Common issues
- Errors about TLS issues on User cration point to something amiss in the mail server configuration.
- Errors about unknown client point to ClientID mismatch between ``api.json`` and ``frontend.json``

### Updates

Before updating make sure that you have properly backed-up your instance so you 
can always roll back to a pre-update state.

### Backups

To backup your instances private data you only need to backup the ``$ROOT`` folder.
This should contain everything needed to start your instance again, no persistent
data lives in docker containers.
