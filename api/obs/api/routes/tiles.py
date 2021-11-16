import gzip
from sqlite3 import connect
from sanic.response import raw

from obs.api.app import app


def get_tile(filename, zoom, x, y):
    """
    Inspired by:
    https://github.com/TileStache/TileStache/blob/master/TileStache/MBTiles.py
    """

    print(filename)
    db = connect(filename)
    db.text_factory = bytes

    fmt = db.execute("SELECT value FROM metadata WHERE name='format'").fetchone()[0]
    if fmt != b"pbf":
        print(repr(b"pbf"), " versus ", repr(fmt))
        raise ValueError("mbtiles file is in wrong format: %s" % fmt)

    content = db.execute(
        "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?",
        (zoom, x, (2 ** zoom - 1) - y),
    ).fetchone()
    return content and content[0] or None


# regenerate approx. once each day
TILE_CACHE_MAX_AGE = 3600 * 24

if app.config.get("TILES_FILE"):

    @app.route(r"/tiles/<zoom:int>/<x:int>/<y:(\d+)\.pbf>")
    async def tiles(req, zoom: int, x: int, y: str):
        tile = get_tile(req.app.config.TILES_FILE, int(zoom), int(x), int(y))

        gzip = "gzip" in req.headers["accept-encoding"]

        headers = {}
        headers["Vary"] = "Accept-Encoding"

        if req.app.config.DEBUG:
            headers["Cache-Control"] = "no-cache"
        else:
            headers["Cache-Control"] = f"public, max-age={TILE_CACHE_MAX_AGE}"

        # The tiles in the mbtiles file are gzip-compressed already, so we
        # serve them actually as-is, and only decompress them if the browser
        # doesn't accept gzip
        if gzip:
            headers["Content-Encoding"] = "gzip"
        else:
            tile = gzip.decompress(tile)

        return raw(tile, content_type="application/x-protobuf", headers=headers)
