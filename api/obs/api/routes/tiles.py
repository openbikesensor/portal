import asyncio
from contextlib import asynccontextmanager
from gzip import decompress
from sqlite3 import connect
from datetime import datetime, time, timedelta
from typing import Optional, Tuple

import dateutil.parser
from sanic.exceptions import Forbidden, InvalidUsage, ServiceUnavailable
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


def round_date(date, to="weeks", up=False):
    if to != "weeks":
        raise ValueError(f"cannot round to {to}")

    midnight = time(0, 0, 0, 0)
    start_of_day = date.date()  # ignore time
    weekday = date.weekday()

    is_rounded = date.time() == midnight and weekday == 0
    if is_rounded:
        return date

    if up:
        return datetime.combine(start_of_day + timedelta(days=7 - weekday), midnight)
    else:
        return datetime.combine(start_of_day - timedelta(days=weekday), midnight)


# regenerate approx. once each day
TILE_CACHE_MAX_AGE = 3600 * 24


def get_filter_options(
    req,
) -> Tuple[Optional[str], Optional[datetime], Optional[datetime]]:
    """
    Returns parsed, validated and normalized options for filtering map data, a
    tuple of

        * user_id (str|None)
        * start (datetime|None)
        * end (datetime|None)
    """
    user_id = req.ctx.get_single_arg("user", default=None, convert=int)
    if user_id is not None and (req.ctx.user is None or req.ctx.user.id != user_id):
        raise Forbidden()

    parse_date = lambda s: dateutil.parser.parse(s)
    start = req.ctx.get_single_arg("start", default=None, convert=parse_date)
    end = req.ctx.get_single_arg("end", default=None, convert=parse_date)

    start = round_date(start, to="weeks", up=False) if start else None
    end = round_date(end, to="weeks", up=True) if end else None

    if start is not None and end is not None and start >= end:
        raise InvalidUsage(
            "end date must be later than start date (note: dates are rounded to weeks)"
        )

    return user_id, start, end


@asynccontextmanager
async def use_tile_semaphore(req, timeout=10):
    """
    If configured, acquire a semaphore for the map tile request and release it
    after the context has finished.

    If the semaphore cannot be acquired within the timeout, issue a 503 Service
    Unavailable error response that describes that the map tile database is
    overloaded, so users know what the problem is.

    Operates as a noop when the tile semaphore is not enabled.
    """
    sem = getattr(req.app.ctx, "_tile_semaphore", None)

    if sem is None:
        yield
        return

    try:
        await asyncio.wait_for(sem.acquire(), timeout)

        try:
            yield
        finally:
            sem.release()

    except asyncio.TimeoutError:
        raise ServiceUnavailable(
            "Too many map content requests, database overloaded. Please retry later."
        )


@app.route(r"/tiles/<zoom:int>/<x:int>/<y:(\d+)\.pbf>")
async def tiles(req, zoom: int, x: int, y: str):
    async with use_tile_semaphore(req):
        if app.config.get("TILES_FILE"):
            tile = get_tile(req.app.config.TILES_FILE, int(zoom), int(x), int(y))

        else:
            user_id, start, end = get_filter_options(req)

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
