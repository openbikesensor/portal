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

Create a folder somewhere in your system, we'll name it `$ROOT` from now on.

Clone the repository to `$ROOT/source`.  Ensure you also cloned the submodules,
as described in the main [README](../README.md).

```bash
mkdir -p /opt/openbikesensor
cd /opt/openbikesensor
git clone --recursive https://github.com/openbikesensor/portal source/
```

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
