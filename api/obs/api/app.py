import logging
import os
from json import JSONEncoder, dumps
from functools import wraps, partial
from urllib.parse import urlparse
from os.path import dirname, join, normpath, abspath, exists, isfile
from datetime import datetime, date

from sanic import Sanic, Blueprint
from sanic.response import text, json as json_response, file as file_response
from sanic.exceptions import Unauthorized, NotFound
from sanic_session import Session, InMemorySessionInterface

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from obs.api.db import User, make_session, connect_db

from sanic_session.base import BaseSessionInterface
from sanic_session.utils import ExpiringDict

log = logging.getLogger(__name__)

app = Sanic("OpenBikeSensor Portal API")
app.update_config("./config.py")
c = app.config

api = Blueprint("api", url_prefix="/api")
auth = Blueprint("auth", url_prefix="")

# Configure paths
c.API_ROOT_DIR = c.get("API_ROOT_DIR") or abspath(join(dirname(__file__), "..", ".."))
c.DATA_DIR = c.get("DATA_DIR") or normpath(join(c.API_ROOT_DIR, "../data"))
c.PROCESSING_DIR = c.get("PROCESSING_DIR") or join(c.DATA_DIR, "processing")
c.PROCESSING_OUTPUT_DIR = c.get("PROCESSING_OUTPUT_DIR") or join(
    c.DATA_DIR, "processing-output"
)
c.TRACKS_DIR = c.get("TRACKS_DIR") or join(c.DATA_DIR, "tracks")
c.OBS_FACE_CACHE_DIR = c.get("OBS_FACE_CACHE_DIR") or join(c.DATA_DIR, "obs-face-cache")
c.FRONTEND_DIR = c.get("FRONTEND_DIR")

if c.FRONTEND_URL:
    from sanic_cors import CORS

    frontend_url = urlparse(c.FRONTEND_URL)
    CORS(
        app,
        origins=[f"{frontend_url.scheme}://{frontend_url.netloc}"],
        supports_credentials=True,
    )

# TODO: use a different interface, maybe backed by the PostgreSQL, to allow
# scaling the API
Session(app, interface=InMemorySessionInterface())


@app.before_server_start
async def app_connect_db(app, loop):
    app.ctx._db_engine_ctx = connect_db(c.POSTGRES_URL)
    app.ctx._db_engine = await app.ctx._db_engine_ctx.__aenter__()


@app.after_server_stop
async def app_disconnect_db(app, loop):
    if hasattr(app.ctx, "_db_engine_ctx"):
        await app.ctx._db_engine_ctx.__aexit__(None, None, None)


@app.middleware("request")
async def inject_session(req):
    req.ctx._session_ctx = make_session()
    req.ctx.db = await req.ctx._session_ctx.__aenter__()
    sessionmaker(req.app.ctx._db_engine, class_=AsyncSession, expire_on_commit=False)()


@app.middleware("response")
async def close_session(req, response):
    if hasattr(req.ctx, "_session_ctx"):
        await req.ctx.db.close()
        await req.ctx._session_ctx.__aexit__(None, None, None)


@app.middleware("request")
async def load_user(req):
    user_id = req.ctx.session.get("user_id")
    user = None
    if user_id:
        user = (
            await req.ctx.db.execute(select(User).where(User.id == user_id))
        ).scalar()

    req.ctx.user = user


def require_auth(fn):
    @wraps(fn)
    def wrapper(req, *args, **kwargs):
        if not req.ctx.user:
            raise Unauthorized("Login required")
        return fn(req, *args, **kwargs)

    return wrapper


class CustomJsonEncoder(JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat() + "+0000"  # explicit UTC for javascript <3

        # Let the base class default method raise the TypeError
        return super().default(obj)


def json(*args, **kwargs):
    return json_response(*args, **kwargs, dumps=partial(dumps, cls=CustomJsonEncoder))


from . import routes

INDEX_HTML = join(c.FRONTEND_DIR, "index.html")
if exists(INDEX_HTML):

    @app.get("/config.json")
    def get_frontend_config(req):
        base_path = req.server_path.replace("config.json", "")
        return json_response(
            {
                **req.app.config.FRONTEND_CONFIG,
                "apiUrl": f"{req.scheme}://{req.host}{base_path}api",
                "loginUrl": f"{req.scheme}://{req.host}{base_path}login",
            }
        )

    @app.get("/<path:path>")
    def get_frontend_static(req, path):
        if path.startswith("api/"):
            raise NotFound()

        file = join(c.FRONTEND_DIR, path)
        if not exists(file) or not path or not isfile(file):
            file = INDEX_HTML
        return file_response(file)


app.blueprint(api)
app.blueprint(auth)

if not app.config.DEDICATED_WORKER:

    async def worker():
        from obs.api.process import process_tracks_loop
        from obs.face.osm import DataSource, DatabaseTileSource

        data_source = DataSource(DatabaseTileSource())

        # run forever
        await process_tracks_loop(data_source, 10)

    app.add_task(worker())
