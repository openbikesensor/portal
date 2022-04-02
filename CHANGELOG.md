# Changelog

## 0.5.2

Starting in this version, the database schema is created through migrations
instead of using the `reset_database.py` script. This means that for both the
initial setup, as well as for upgrades, only the migrations have to be run.

After updating and migrating, it is good practice to regenerate the SQL tile
functions (`api/tools/prepare_sql_tiles.py`) as well. It doesn't matter if you
do this when it is not required, so we've written a simple all-in-one update
script that you can run to do all upgrade tasks. This is now in
`api/tools/upgrade.py`.

Please check [`UPGRADING.md`](./UPGRADING.md) for more details if you're
upgrading an existing installation. It contains an important note for this
upgrade in particular.

## 0.5.1

Maintenance release, only includes build, deployment and documentation changes.

## 0.5.0

### Features

* Use discrete colors for distances, with greens only above 1.5m
* Use viridis colormap for roads' count layers
* Generate usage count information (how often has a road been traveled)
* Project the whole track to the map, and show both versions
* Log out of OpenID server when logging out of application
* Convert speed units to km/h in frontend
* Pages now have titles (#148)
* Remove map from home page, it was empty anyway (#120)

### Internal

* Add alembic setup for migrating
* Build osm2pgsql with -j4
* Update sqlalchemy[asyncio] requirement from ~=1.4.31 to ~=1.4.32 in /api

## 0.4.2

### Features

### Bugfixes

* Fix export route, it should be a child of /api 

## 0.4.1

### Features

* Add page for exporting data through web frontend
* Generate GPX track file when importing a track
* Add GPX track export button on the track page (accessible for anybody who can
  see the track)

## 0.4.0

### Improvements

* Retry OpenID Connect connection if it fails on boot
* Format log outputs with color and improve access log
* Make pool_size and overflow configurable for worker and portal
* Add a route for exporting events as GeoJSON/Shapefile
* Point footer to forum, not slack (fixes #140)
* Improve wording on profile page ("My" instead of "Your")
* Show "My tracks" directly in main menu (fixes #136)

### Bugfixes

* Make sure the API can recover from the broken postgresql connection state
* Remove duplicate events from the same track
* Fix direction of road segments (fixes #142)
* Solve a few problems with the colormap scales in the map view 

### Docs & deployment

* Greatly improve deployement docs for a simple follow-along routine
* Use environment variables (`OBS_*`) for configuration
* Fix port numbers in example files and expose 3000 in the image
* Add `LEAN_MODE` configuration to disable `road` database table usage and fall
  back to Overpass API for processing tracks (see
  [docs/lean-mode.md](docs/lean-mode.md)).
* Read `config.overrides.py` file if it exists
* Add osm2pgsql to portal image to be able to import OSM data from within the
  container
* Fix path to roads_import.lua in docs
* Explain to use the portal service, instead of api, in production
* Use entrypoint instead of command, so you can run process_track.py one-off tasks

### Internals

* Use custom `get_single_arg` everywhere, remove sanicargs (fixes #193)
* Update requirements and make them consistent
* Fix error handling, especially for file uploads
 

## 0.3.4

### Features

* Reintroduce event view (fixes #111)
* Add layer configuration panel to map page
  - Allow choosing basemap style
  - Add toggles for event and road layers
  - Make untagged roads display optional
  - Show a legend for event color
  - Alow choosing attribute used for coloring road segments
* Add optional banner to frontend via config entry (solves #128)

### Bugfixes

* Clicking on road without events should not cause 500 error
* Improve mobile layout a bit (fixes #123)

### Technical

* Allow explicit configuration of api base url via `API_URL` config
* Remove outdated "mapTileset" frontend config section
