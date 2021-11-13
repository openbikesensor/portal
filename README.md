# OpenBikeSensor Portal

This repository contains the source code required to run the
[OpenBikeSensor](https://openbikesensor.org) data collection portal. It is
separated into components:

* **api**: The backend service, written in JavaScript for Node.js, using
  express.js, and a MongoDB for metadata storage.
* **frontend**: A React single-page application that allows access to the data,
  provides summaries and visualizations, and lets users adjust settings and
  manage and publish their tracks.

## Clone the Project

First of all, you must clone this project. This project uses submodules,
thus ensure, that they are cloned as well:

```bash
git clone --recursive https://github.com/openbikesensor/portal

# ... or if you forgot the --recursive argument, you can run this in the
# repository's directory later:
git submodule update --init --recursive
```

## Production setup

There is a guide for a deployment based on docker in the
[deployment](deployment) folder. Lots of non-docker deployment strategy are
possible, but they are not "officially" supported, so please do not expect the
authors of the software to assist in troubleshooting. 

This is a rather complex application, and it is expected that you know the
basics of deploying a modern web application securely onto a production server.
We are sorry that we cannot guide you through all the details of that, as we
just don't have the capacities to do so. Please research the respective topics
first. If you struggle with application-specific issues, please let us know, we
might be able to assist with those.

Please note that you will always need to install your own reverse proxy that
terminates TLS for you and handles certificates. We do not support TLS directly
in the application, instead, please use this prefered method. 

### Migrating (Production)

Migrations are not implemented yet. Once we need them, we'll add them and
document the usage here.

### Upgrading from v0.2 to v0.3

After v0.2 we switched the underlying technology of the API and the database.
We now have no more MongoDB, instead, everything has moved to the PostgreSQL
installation. For development setups, it is advised to just reset the whole
state (remove the `local` folder) and start fresh. For production upgrades,
please follow the relevant section in [`UPGRADING.md`](./UPGRADING.md).


## Development setup

We've moved the whole development setup into Docker to make it easy for
everyone to get involved. 

### Install docker

Please [install Docker Engine](https://docs.docker.com/engine/install/) as well as 
[Docker Compose](https://docs.docker.com/compose/install/) onto your machine. 

Then clone the repository as described above.

### Configure Keycloak


Login will not be possible until you configure the keycloak realm correctly. Boot your keycloak instance:

```bash
docker-compose up -d --build keycloak
```

Now navigate to http://localhost:3003/ and follow these steps:

* Click "Administration Console" and log in with `admin` / `admin`
* Hover over the realm name on the top left and click "Add realm"
* Name the Realm `OBS Dev` (spelling matters) and create it
* In the sidebar, navigate to Configure -> Clients, and click "Create" on the top right
* Client ID is `portal`. Hit "Save".
* In the Tab "Settings", edit the new client's "Access Type" to `confidential`
  and enter as "Valid Redirect URIs": `http://localhost:3000/login/redirect`,
  then "Save"
* Under "Credentials", copy the "Secret" and paste it into `api/config.dev.py`
  as `KEYCLOAK_CLIENT_SECRET`. Please do not commit this change to git.
* In the sidebar, navigate to Manage -> Users, and click "Add user" on the top right.
* Give the user a name (e.g. `test`), leave the rest as-is.
* Under the tab "Credentials", set a new password, and make it non-temporary.
  Press "Set Password".

We are going to automate this process. For now, you will have to repeat it
every time you reset the keycloak datbaase, which is inside the PostgreSQL. The
script `api/tools/reset_database.py` does *not* affect the state of the
keycloak database, however, so this should be rather rare.

### Boot the application

Now you can run the remaining parts of the application:

```bash
docker-compose up -d --build api worker frontend
```

If this does not work, please open an issue and describe the problem you're
having, as it is important to us that onboarding is super easy :)

Your frontend should be running at http://localhost:3001 and the API at
http://localhost:3000 -- but you probably only need to access the frontend for
testing. The frontend dev server also proxies all unknown requests to the API,
so the frontend always just requests data at its own URL.

### Migrating (Development)

Migrations are not implemented yet. Once we need them, we'll add them and
document the usage here.

## Tileserver generation

The above instructions do not include the serving of vector tiles with the
collected data. That is to be set up separately. Please follow the instructions
in [tile-generator](./tile-generator/README.md).

