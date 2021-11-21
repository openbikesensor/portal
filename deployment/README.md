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

### Create a keycloak instance

Follow the official guides to create your own keycloak server:

https://www.keycloak.org/documentation

Documenting the details of this is out of scope for our project. Please make sure to configure:

* an admin account for yourself
* a realm for the portal
* a client in that realm with "Access Type" set to "confidential" and a
  redirect URL of this pattern: `https://portal.example.com/login/redirect`

### Configure portal

```bash
cp source/api/config.py.example config/config.py
```

Then edit `config/config.py` to your heart's content (and matching the
configuration of the keycloak). Do not forget to generate a secure secret
string.

### Build container and run them

```bash
docker-compose build portal
docker-compose up -d portal
```

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
data lives in docker containers.
