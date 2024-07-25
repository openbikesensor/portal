# Changelog

## 0.9.0

### Features

* New import logic with advanced road snapping
* Add link to open way details in OSM
* Add custom basemap style for better readability of colored overlays
* Add "My tracks" layer for logged-in users
* Add new darkmatter base map style

### Improvements

* Make items on map page smaller to fit higher density
* Change gradient from viridis to plasma
* Show processing errors on track page and in track list
* Use logarithmic color scales for event and usage count
* Show only one color axis (rural or urban) at a time, add a dropdown to switch it

### Bug Fixes

* Fix statistics (track, members, ...)
* Filter out roads tagged with `motorroad`
* Do not translate language names, so people find their own language in the list


## 0.8.1

### Improvements

* The zone (urban/rural) is now also exported with the events GeoJson export.

### Bug Fixes

* Update to a current version of gpstime (python dependency) fix portal startup.

## 0.8.0

### Features

* Bulk actions on users owned tracks (reprocess, download, make private, make public, delete) (#269, #38)
* Easy sorting by device for "multi-device users" (e.g. group lending out OBSes)
* Region display at higher zoom levels to easily find interesting areas (#112)
* Export of road statistics on top of the already-existing event statistics (#341)

### Improvements

* Refactored database access to hopefully combat portal crashes (#337)
* New infrastructure for map imports that makes import of larger maps possible on small VMs (#334)
* Reference current postgres and postgis versions in docker-compose.yaml files (#286)
* Configurable terms-and-conditions link (#320)
* French translation by @cbiteau (#303)

### Bug Fixes

* Logout not working (#285)
* Duplicate road usage hashes (#335, #253)
* cannot import name .... (#338)

## 0.7.0

### Features

* Add histogram of overtaking distances in road details panel
* Flip table in road details panel and make it easier to read
* Implement difference between urban and rural for events and road segments.
* Better road zone detection in import
* Make the frontend translatable and add German translation
* Add time and user filters to map view (for logged-in users only)

### Improvements

* Make raw track not look like a river (#252)
* Update many dependencies

### Bug fixes

* Overtaking events are now deleted when the parent track is deleted (#206)
* Remove useless session creation (#192)
* Remove some error logs for canceled requests (as the map page tends to do that quite a lot)
* Fix ExportPage bounding box input


## 0.6.2

### Improvements

* Prevent directory traversals inside container on python-served frontend.

## 0.6.1

### Improvements

* Make road details request (clicking on a road segment in the map) way faster
  by using PostGIS geometry index correctly (#226).

## 0.6.0

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
