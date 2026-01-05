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

First of all, you must clone this project. This project **does not** use
submodules anymore:

```bash
git clone https://github.com/openbikesensor/portal
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

### Prepare the setup

> [!WARNING]
> The following assumes that you run from a fresh clone of the git repo.
> It will complain if it detects issues. Never run the development portal init
> on a machine with a production portal.

> > [!WARNING]
> The development setup is automatic with unsafe passwords and only exposed
> to localhost. Do not expose the ports.

Have a look at ``init_development_portal.sh`` - these are the steps that will set up your development portal.
The script needs you to run with root permissions or the running user needs to be part of the ``docker`` group to
set up the containers.

After running it, you should have a bunch of containers running, which should only listen to localhost:
- keycloak on http://localhost:3003
  - Admin user: `admin`, password: `admin`
  - You see why this should only run on localhost.
  - The internal "testing only" disk-based database is used.
- Openbikesensor api on http://localhost:3000
- Openbikesensor frontend on http://localhost:3001
  - User `obs`, password `obs`
  - You can see why this should only run on localhost


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
* `frontend/src/mapstyles/darkmatter.json`

There are lots of other licenses to consider when using this software,
especially in conjunction with imported data and other tools. Check out the
[Licenses Documentation](docs/licenses.md) for an (unofficial) overview of the
license landscape surrounding this project.
