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


Login will not be possible until you configure the keycloak realm correctly. Boot your postgres and
keycloak instances:

```bash
docker-compose up -d postgres
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
- Under *Credentials*, copy the *Secret* and paste it into `api/config.dev.py`
  as `KEYCLOAK_CLIENT_SECRET`. Please do not commit this change to git.
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

Next, initialize an empty database, which applies the database schema for the
application:

```bash
docker-compose run --rm api tools/reset_database.py
```

To be able serve dynamic vector tiles from the API, run the following command once:

```bash
docker-compose run --rm api tools/prepare_sql_tiles.py
```

You might need to re-run this command after updates, to (re-)create the
functions in the SQL database that are used when generating vector tiles.

You should also import OpenStreetMap data now, see below for instructions.

### Boot the application

Now you can run the remaining parts of the application:

```bash
docker-compose up -d --build api worker frontend
```

Your frontend should be running at http://localhost:3001 and the API at
http://localhost:3000 -- but you probably only need to access the frontend for
testing. 

### Migrating (Development)

Migrations are not implemented yet. Once we need them, we'll add them and
document the usage here.


## Import OpenStreetMap data

You need to import road information from OpenStreetMap for the portal to work.
This information is stored in your PostgreSQL database and used when processing
tracks (instead of querying the Overpass API), as well as for vector tile
generation. The process applies to both development and production setups. For
development, you should choose a small area for testing, such as your local
county or city, to keep the amount of data small. For production use you have
to import the whole region you are serving.

* Install `osm2pgsql`. 
* Download the area(s) you would like to import from [GeoFabrik](https://download.geofabrik.de). 
* Import each file like this:

    ```bash
    osm2pgsql --create --hstore --style api/roads_import.lua -O flex \
      -H localhost -d obs -U obs \
      path/to/downloaded/myarea-latest.osm.pbf 
    ```

You might need to adjust the host, database and username (`-H`, `-d`, `-U`) to
your setup, and also provide the correct password when queried. For the
development setup the password is `obs`. For production, you might need to
expose the containers port and/or create a TCP tunnel, for example with SSH,
such that you can run the import from your local host and write to the remote
database.

The import process should take a few seconds to minutes, depending on the area
size. A whole country might even take one or more hours. You should probably
not try to import `planet.osm.pbf`. 

You can run the process multiple times, with the same or different area files,
to import or update the data. However, for this to work, the actual [command
line arguments](https://osm2pgsql.org/doc/manual.html#running-osm2pgsql) are a
bit different each time, including when first importing, and the disk space
required is much higher. 

Refer to the documentation of `osm2pgsql` for assistance. We are using "flex
mode", the provided script `api/roads_import.lua` describes the transformations
and extractions to perform on the original data.

## Troubleshooting

If any step of the instructions does not work for you, please open an issue and
describe the problem you're having, as it is important to us that onboarding is
super easy :)

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
