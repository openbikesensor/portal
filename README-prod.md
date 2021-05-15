*HINT: This is still work in progress*

# Use Docker in Production (with Traefik)

## Introduction

The main idea of this document is to provide an easy docker-based production-ready 
setup of the openbikesensor portal. 
It uses the [the traefik proxy](and https://doc.traefik.io/traefik/) as a reverse proxy, 
which listens on port 80 and 443.
Based on some labels, traefik routes the domains to the corresponding docker-containers:

```
                  /---:3000[api]
--->:443[traefik] -
                  \---:80[frontend]
                   \
                    \---:80[other-service]
```

# Before Getting Started

We assume, we have two (sub)domains, which point to the same server ip-address,
for example by using CNAME DNS entries. This documentation assumes the following two domains:

* api.example.com
* portal.example.com

These domains are also configured in the example configuration files,
provided in this repository. We'll tackle them in the next section.

## Details

1) Clone the repo as described in the [README.md](README.md)

Ensure, you also cloned the submodules!

2) Copy and edit `treafik.toml`:

```bash
cp treafik/treafik.toml.example treafik/treafik.toml
nano treafik/treafik.toml
```

* Configure you email in the `traefik/traefil.toml`. 
  This email is uses by Let's Encrypt to send you some mails regarding your certificates.

3) Copy and edit the `docker-compose-prod.yaml`:

```
cp docker-compose-prod.yaml.example docker-compose-prod.yaml
nano docker-compose-prod.yaml
```

* Change the domain of the label of the API:
  `traefik.http.routers.obsapi.rule=Host(api.example.com)`
* Change the domain of the label of the portal:
  `traefik.http.routers.obsapi.rule=Host(portal.example.com)`

3) Copy and edit the `config.json` of the frontend:

```bash
cp frontend/src/config.json.example frontend/src/config.json
nano frontend/src/config.json
```

* Change all URLs to your (sub)domains
* Create a UUID by using `uuidgen` and set the `clientId`

4) Copy and edit the `config.json` of the api:

```bash
cp api/config.json.example api/config.json
nano api/config.json
```

* Change all URLs to your (sub)domains
* Generate and set a random `cookieSecret` (for example with `uuidgen`)
* Generate and set a random `jwtSecret` (for example with `uuidgen`)
* Configure you SMTP mail server
* Set the `clientId` for the `oAuth2Client` of the portal (from step 3)

5) Build container and run them:

```bash
docker-compose -f docker-compose-prod.yaml up -d --build
```

The services are build now. It can take some minutes. 
At the end you sould see:

```
Recreating obsexamplecom_traefik_1 ... done
Creating obsexamplecom_mongo_1     ... done
Creating obsexamplecom_redis_1     ... done
Creating obsexamplecom_worker_1    ... done
Creating obsexamplecom_api_1       ... done
Creating obsexamplecom_frontend_1  ... done
```

6) Take a look into the logs!

Now, you can watch the logs:

```bash
docker-compose -f docker-compose-prod.yaml logs -f
```

If something went wrong, you can reconfigure your config files and rerun:

```
docker-compose -f docker-compose-prod.yaml build --no-cache
docker-compose -f docker-compose-prod.yaml up -d
```

7) Test the API and the frontend:

* https://api.example.com/login
* https://portal.example.com


# TODO

touch traefik/acme.json
chmod 600 traefik/acme.json