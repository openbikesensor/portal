from gzip import decompress
from sqlite3 import connect

import dateutil.parser
from sanic.exceptions import Forbidden
from sanic.response import raw

from sqlalchemy import select, text
from sqlalchemy.sql.expression import table, column

from obs.api.app import app


def get_tile(filename, zoom, x, y):
    """
    Inspired by:
    https://github.com/TileStache/TileStache/blob/master/TileStache/MBTiles.py
    """

    db = connect(filename)
    db.text_factory = bytes

    fmt = db.execute("SELECT value FROM metadata WHERE name='format'").fetchone()[0]
    if fmt != b"pbf":
        raise ValueError("mbtiles file is in wrong format: %s" % fmt)

    content = db.execute(
        "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?",
        (zoom, x, (2**zoom - 1) - y),
    ).fetchone()
    return content and content[0] or None


# regenerate approx. once each day
TILE_CACHE_MAX_AGE = 3600 * 24


@app.route(r"/tiles/<zoom:int>/<x:int>/<y:(\d+)\.pbf>")
async def tiles(req, zoom: int, x: int, y: str):
    if app.config.get("TILES_FILE"):
        tile = get_tile(req.app.config.TILES_FILE, int(zoom), int(x), int(y))

    else:
        user_id = None
        username = req.ctx.get_single_arg("user", default=None)
        if username is not None:
            if req.ctx.user is None or req.ctx.user.username != username:
                raise Forbidden()
            user_id = req.ctx.user.id

        parse_date = lambda s: dateutil.parser.parse(s)
        start = req.ctx.get_single_arg("start", default=None, convert=parse_date)
        end = req.ctx.get_single_arg("end", default=None, convert=parse_date)

        tile = await req.ctx.db.scalar(
            text(
                f"select data from getmvt(:zoom, :x, :y, :user_id, :min_time, :max_time) as b(data, key);"
            ).bindparams(
                zoom=int(zoom),
                x=int(x),
                y=int(y),
                user_id=user_id,
                min_time=start,
                max_time=end,
            )
        )

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

    if not gzip:
        tile = decompress(tile)

    return raw(tile, content_type="application/x-protobuf", headers=headers)
