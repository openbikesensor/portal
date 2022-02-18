# Lean mode

The application can be configured in "lean mode" through the `LEAN_MODE`
setting in `config.py`. A lean installation is easier to set up, as a few steps
can be skipped. However, the performance of the application will degrade in
lean mode, and lots of advanced features will not be available.

Lean mode is meant as an entrypoint to get started with collecting data,
without the hassle of importing and maintaining OpenStreetMap data.

## Disabled features in lean mode

* No map tiles are generated.
* The frontend will not show an overview map, only per-track maps.
* The `roads` database table is not used, neither for processing tracks, nor
  for generating map tiles.
* The API will not generate auxiliary information for display on the
  (nonexistent) map, such as per-road statistics.

## Switch to/from lean mode 

To enable lean mode, set the following in your `config.py` (or in
`config.overrides.py`, especially in development setups):

```python
LEAN_MODE = True
```

To disable lean mode, set it to `False` instead.

For lean mode, it is important that the config variable `OBS_FACE_CACHE_DIR` is
properly set, or that you are happy with its default value of using
`$DATA_DIR/obs-face-cache`.

When turning off lean mode, make sure to fill your `roads` table properly, as
otherwise the track processing will not work. When turning on lean mode, you
may truncate the `roads` table to save space, but you don't need to, it simply
becomes unused.

## Benefits

* When using lean mode, you can skip the import of OpenStreetMap data during
  setup, and you also do not need to keep it updated. 
* People can already start uploading data and the data is also processed,
  giving you as a maintainer more time to set up the full application, if you
  want to.

## Drawbacks

* Lean mode is less performant when processing tracks.
* Lean mode track processing depends on the Overpass API data source, which may
  be slow, unavailable, or rate limiting the requests, so processing may fail.
  We use caching to prevent some issues, but as we depend on a third party
  service here that is accessed for free and that generates a lot of server
  load, we really can't ask for much. If you frequently run into issues, the
  best bet is to manage OSM data yourself and turn off lean mode.
* Of course some features are missing.
