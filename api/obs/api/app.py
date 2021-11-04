import logging
import os
from json import JSONEncoder, dumps
from functools import wraps, partial
from urllib.parse import urlparse
from os.path import dirname, join, normpath, abspath
from datetime import datetime, date

from sanic import Sanic
from sanic.response import text, json as json_response
from sanic.exceptions import Unauthorized
from sanic_session import Session, InMemorySessionInterface
from sanic_cors import CORS

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from obs.api.db import User, async_session

from sanic_session.base import BaseSessionInterface
from sanic_session.utils import ExpiringDict

log = logging.getLogger(__name__)

app = Sanic("OpenBikeSensor Portal API")
app.update_config("./config.py")
c = app.config

# Configure paths
c.API_ROOT_DIR = c.get("API_ROOT_DIR") or abspath(join(dirname(__file__), "..", ".."))
c.DATA_DIR = c.get("DATA_DIR") or normpath(join(c.API_ROOT_DIR, "../data"))
c.PROCESSING_DIR = c.get("PROCESSING_DIR") or join(c.DATA_DIR, "processing")
c.PROCESSING_OUTPUT_DIR = c.get("PROCESSING_OUTPUT_DIR") or join(
    c.DATA_DIR, "processing-output"
)
c.TRACKS_DIR = c.get("TRACKS_DIR") or join(c.DATA_DIR, "tracks")
c.OBS_FACE_CACHE_DIR = c.get("OBS_FACE_CACHE_DIR") or join(c.DATA_DIR, "obs-face-cache")

main_frontend_url = urlparse(c.MAIN_FRONTEND_URL)
CORS(
    app,
    origins=[f"{main_frontend_url.scheme}://{main_frontend_url.netloc}"],
    supports_credentials=True,
)

# TODO: use a different interface, maybe backed by the PostgreSQL, to allow
# scaling the API
Session(app, interface=InMemorySessionInterface())


@app.before_server_start
async def app_connect_db(app, loop):
    app.ctx._db_engine = create_async_engine(c.POSTGRES_URL, echo=c.DEBUG)


@app.after_server_stop
async def app_disconnect_db(app, loop):
    if app.ctx._db_engine:
        await app.ctx._db_engine.dispose()


@app.middleware("request")
async def inject_session(req):
    req.ctx.db = sessionmaker(
        req.app.ctx._db_engine, class_=AsyncSession, expire_on_commit=False
    )()
    req.ctx._db_session_ctx_token = async_session.set(req.ctx.db)


@app.middleware("response")
async def close_session(req, response):
    if hasattr(req.ctx, "_db_session_ctx_token"):
        async_session.reset(req.ctx._db_session_ctx_token)
        await req.ctx.db.close()


@app.middleware("request")
async def load_user(req):
    user_id = req.ctx.session.get("user_id")
    user = None
    if user_id:
        user = (
            await req.ctx.db.execute(select(User).where(User.id == user_id))
        ).scalar()

    req.ctx.user = user


@app.route("/")
def index(req):
    return text("Hello, %s!" % (req.ctx.user.username if req.ctx.user else "World"))


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
