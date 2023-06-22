# OpenBikeSensor Portal

This repository contains the source code required to run the
[OpenBikeSensor](https://openbikesensor.org) data collection portal. It is
separated into components:

* **api**: The backend service, written in Python 3 with
  [Sanic](https://sanicframework.org/),
  [SQLAlchemy](https://www.sqlalchemy.org/), and a PostgreSQL/PostGIS database
  for storage. It also depends highly on
  [OpenMapTiles](https://openmaptiles.org) to generate vector tiles of the
  data.
* **frontend**: A React single-page application that allows access to the data,
  provides summaries and visualizations, and lets users adjust settings and
  manage and publish their tracks.

Check out the [Architecture Documentation](docs/architecture.md) for more
details on what parts the whole application is made of.

This project follows [semantic versioning](https://semver.org). Refer to [issue
#44](https://github.com/openbikesensor/portal/issues/44) for a description of
what that means for our project and what is considered the public interface.

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

There is a guide for a deployment based on docker at
[docs/production-deployment.md](docs/production-deployment.md). Lots of
non-docker deployment strategies are possible, but they are not "officially"
supported, so please do not expect the authors of the software to assist in
troubleshooting. 

This is a rather complex application, and it is expected that you know the
basics of deploying a modern web application securely onto a production server.
We are sorry that we cannot guide you through all the details of that, as we
just don't have the capacities to do so. Please research the respective topics
first. If you struggle with application-specific issues, please let us know, we
might be able to assist with those.

Please note that you will always need to install your own reverse proxy that
terminates TLS for you and handles certificates. We do not support TLS directly
in the application, instead, please use this prefered method. 

Upgrading and migrating is described in [UPGRADING.md](./UPGRADING.md) for each
version.

### Migrating (Production)

Migrations are done with
[Alembic](https://alembic.sqlalchemy.org/en/latest/index.html), please refer to
its documentation for help. Most of the time, running this command will do all
the migrations you need:

```bash
docker-compose run --rm api tools/upgrade.py
```

This command is equivalent to running migrations through *alembic*, then
regenerating the SQL functions that compute vector tiles directly in the
database:

```bash
# equivalent to the above command, you don't usually run these
docker-compose run --rm api alembic upgrade head
docker-compose run --rm api tools/prepare_sql_tiles
```

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
docker-compose up -d keycloak
```

Now navigate to http://localhost:3003/ and follow these steps:

- Click *Administration Console* and log in with `admin` / `admin`.
- Hover over the realm name on the top left and click *Add realm*.
- Name the Realm `obs-dev` (spelling matters) and create it.
- In the sidebar, navigate to *Configure* &rarr; *Clients*, and click *Create* on the top right.
- *Client ID* should be `portal`. Click *Save*.
- In the Tab *Settings*, edit the new client's *Access Type* to *confidential*
  and enter as *Valid Redirect URIs*: `http://localhost:3000/login/redirect`,
  then *Save*
- Under *Credentials*, copy the *Secret*. Create a file at `api/config.overrides.py` with the secret in it:
  
  ```python
  KEYCLOAK_CLIENT_SECRET="your secret here"
  ```
  
  You can use this file in development mode to change settings without editing
  the git-controlled default file at `api/config.dev.py`. Options in this file
  take precendence.
- In the sidebar, navigate to *Manage* &rarr; *Users*, and click *Add user* on the top right.
- Give the user a name (e.g. `test`), leave the rest as-is.
- Under the tab *Credentials*, choose a new password, and make it
  non-temporary. Click *Set Password*.

We are going to automate this process. For now, you will have to repeat it
every time you reset your keycloak settings, which are stored inside the
PostgreSQL as well. Luckily, the script `api/tools/reset_database.py` does
*not* affect the state of the keycloak database, so this should be rather rare.

### Prepare database

Start the PostgreSQL database:

```bash
docker-compose up -d postgres
```

The first time you start postgres, a lot of extensions will be installed. This
takes a while, so check the logs of the docker container until you see:

> PostgreSQL init process complete; ready for start up.

If you don't wait long enough, the following commands might fail. In this case,
you can always stop the container, remove the data directory (`local/postgres`)
and restart the process.

Next, run the upgrade command to generate the database schema:

```bash
docker-compose run --rm api tools/upgrade.py
```

You will need to re-run this command after updates, to migrate the database and
(re-)create the functions in the SQL database that are used when generating
vector tiles.

You should also [import OpenStreetMap data](docs/osm-import.md) now.

### Boot the application

Now you can run the remaining parts of the application:

```bash
docker-compose up -d --build api worker frontend
```

Your frontend should be running at http://localhost:3001 and the API at
http://localhost:3000 -- but you probably only need to access the frontend for
testing. 

### Migrating (Development)

Migrations are done with
[Alembic](https://alembic.sqlalchemy.org/en/latest/index.html), please refer to
its documentation for help. Most of the time, running this command will do all
the migrations you need:

```bash
docker-compose run --rm api alembic upgrade head
```



## Troubleshooting

If any step of the instructions does not work for you, please open an issue and
describe the problem you're having, as it is important to us that onboarding is
super easy :)

### Connecting to the PostgreSQL database

If you need to connect to your development PostgreSQL database, you should
install `psql` locally. The port 5432 is already forwarded, so you can connect with:
  
```
psql -h localhost -U obs -d obs
```

The password is `obs` as well.
  
## License
  
    Copyright (C) 2020-2021 OpenBikeSensor Contributors
    Contact: https://openbikesensor.org
    
    The OpenBikeSensor Portal is free software: you can redistribute it
    and/or modify it under the terms of the GNU Lesser General Public License
    as published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.
    
    The OpenBikeSensor Portal is distributed in the hope that it will be
    useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser
    General Public License for more details.
    
    You should have received a copy of the GNU Lesser General Public License
    along with the OpenBikeSensor Portal. If not, see
    <http://www.gnu.org/licenses/>.

See also [`COPYING`](./COPYING) and [`COPYING.LESSER`](./COPYING.LESSER).

The above does not apply to the files listed below, their respective licenses
are included in a file next to each of them, named accordingly:

* `frontend/src/mapstyles/bright.json`
* `frontend/src/mapstyles/positron.json`

There are lots of other licenses to consider when using this software,
especially in conjunction with imported data and other tools. Check out the
[Licenses Documentation](docs/licenses.md) for an (unofficial) overview of the
license landscape surrounding this project.
