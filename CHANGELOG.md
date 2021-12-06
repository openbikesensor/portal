# Changelog

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
