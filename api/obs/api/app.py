import logging
import re
from json import JSONEncoder, dumps
from functools import wraps, partial
from urllib.parse import urlparse
from os.path import dirname, join, normpath, abspath
from datetime import datetime, date

from sanic import Sanic, Blueprint
from sanic.response import (
    text,
    json as json_response,
    file as file_response,
    html as html_response,
)
from sanic.exceptions import Unauthorized, SanicException
from sanic_session import Session, InMemorySessionInterface

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from obs.api.db import User, make_session, connect_db

log = logging.getLogger(__name__)

app = Sanic("OpenBikeSensor Portal API", log_config={})
app.update_config("./config.py")
c = app.config

api = Blueprint("api", url_prefix="/api")
auth = Blueprint("auth", url_prefix="")


@app.exception(SanicException, BaseException)
async def _handle_sanic_errors(_request, exception):
    log.error("Exception in handler: %s", exception, exc_info=True)
    return json_response(
        {
            "errors": {
                type(exception).__name__: str(exception),
            },
        },
        status=exception.status_code if hasattr(exception, "status_code") else 500,
    )


# Configure paths
def configure_paths(c):
    c.API_ROOT_DIR = c.get("API_ROOT_DIR") or abspath(
        join(dirname(__file__), "..", "..")
    )
    c.DATA_DIR = c.get("DATA_DIR") or normpath(join(c.API_ROOT_DIR, "../data"))
    c.PROCESSING_DIR = c.get("PROCESSING_DIR") or join(c.DATA_DIR, "processing")
    c.PROCESSING_OUTPUT_DIR = c.get("PROCESSING_OUTPUT_DIR") or join(
        c.DATA_DIR, "processing-output"
    )
    c.TRACKS_DIR = c.get("TRACKS_DIR") or join(c.DATA_DIR, "tracks")
    c.OBS_FACE_CACHE_DIR = c.get("OBS_FACE_CACHE_DIR") or join(
        c.DATA_DIR, "obs-face-cache"
    )
    c.FRONTEND_DIR = c.get("FRONTEND_DIR")


configure_paths(app.config)


def setup_cors(app):
    frontend_url = app.config.get("FRONTEND_URL")
    additional_origins = app.config.get("ADDITIONAL_CORS_ORIGINS")
    if not frontend_url and not additional_origins:
        # No CORS configured
        return

    origins = []
    if frontend_url:
        u = urlparse(frontend_url)
        origins.append(f"{u.scheme}://{u.netloc}")

    if isinstance(additional_origins, str):
        origins += re.split(r"\s+", additional_origins)
    elif isinstance(additional_origins, list):
        origins += additional_origins
    elif additional_origins is not None:
        raise ValueError(
            "invalid option type for ADDITIONAL_CORS_ORIGINS, must be list or space separated str"
        )

    from sanic_cors import CORS

    CORS(
        app,
        origins=origins,
        supports_credentials=True,
    )


setup_cors(app)

# TODO: use a different interface, maybe backed by the PostgreSQL, to allow
# scaling the API
Session(app, interface=InMemorySessionInterface())


@app.before_server_start
async def app_connect_db(app, loop):
    app.ctx._db_engine_ctx = connect_db(app.config.POSTGRES_URL, app.config.POSTGRES_POOL_SIZE, app.config.POSTGRES_MAX_OVERFLOW)
    app.ctx._db_engine = await app.ctx._db_engine_ctx.__aenter__()


@app.after_server_stop
async def app_disconnect_db(app, loop):
    if hasattr(app.ctx, "_db_engine_ctx"):
        await app.ctx._db_engine_ctx.__aexit__(None, None, None)


def remove_right(l, r):
    if l.endswith(r):
        return l[: -len(r)]
    return l


@app.middleware("request")
async def inject_urls(req):
    if req.app.config.FRONTEND_HTTPS:
        req.ctx.frontend_scheme = "https"
    elif req.app.config.FRONTEND_URL:
        req.ctx.frontend_scheme = (
            "http" if req.app.config.FRONTEND_URL.startswith("http://") else "https"
        )
    else:
        req.ctx.frontend_scheme = req.scheme

    if req.app.config.get("API_URL"):
        req.ctx.api_url = req.app.config.API_URL.rstrip("/")
        api_url_parsed = urlparse(req.ctx.api_url)
        req.ctx.api_scheme = api_url_parsed.scheme  # just use the same for now
        req.ctx.api_base_path = api_url_parsed.path
    else:
        req.ctx.api_scheme = req.ctx.frontend_scheme  # just use the same for now
        req.ctx.api_base_path = remove_right(req.server_path, req.path)
        req.ctx.api_url = (
            f"{req.ctx.frontend_scheme}://{req.host}{req.ctx.api_base_path}"
        )

    if req.app.config.FRONTEND_URL:
        req.ctx.frontend_base_path = "/" + urlparse(
            req.app.config.FRONTEND_URL
        ).path.strip("/")
        req.ctx.frontend_url = req.app.config.FRONTEND_URL.rstrip("/")
    elif app.config.FRONTEND_DIR:
        req.ctx.frontend_base_path = req.ctx.api_base_path
        req.ctx.frontend_url = req.ctx.api_url

    else:
        req.ctx.frontend_base_path = "/"
        req.ctx.frontend_url = (
            f"{req.ctx.frontend_scheme}://{req.host}{req.ctx.frontend_base_path}"
        )


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


def read_api_key(fn):
    """
    A middleware decorator to read the API Key of a user. It is an opt-in to
    allow usage with API Keys on certain urls. Combine with require_auth to
    actually check whether a user was authenticated through this. If a login
    session exists, the api key is ignored.
    """

    @wraps(fn)
    async def wrapper(req, *args, **kwargs):
        # try to parse a token if one exists, unless a user is already authenticated
        if (
            not req.ctx.user
            and isinstance(req.token, str)
            and req.token.lower().startswith("obsuserid ")
        ):
            try:
                api_key = req.token.split()[1]
            except LookupError:
                api_key = None

            if api_key:
                user = (
                    await req.ctx.db.execute(
                        select(User).where(User.api_key == api_key.strip())
                    )
                ).scalar()

                if not user:
                    raise Unauthorized("invalid OBSUserId token")

                req.ctx.user = user

        return await fn(req, *args, **kwargs)

    return wrapper


class CustomJsonEncoder(JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat() + "+0000"  # explicit UTC for javascript <3

        # Let the base class default method raise the TypeError
        return super().default(obj)


def json(*args, **kwargs):
    return json_response(*args, **kwargs, dumps=partial(dumps, cls=CustomJsonEncoder))


from .routes import (
    info,
    login,
    stats,
    tiles,
    tracks,
    users,
    mapdetails,
    exports,
)

from .routes import frontend


app.blueprint(api)
app.blueprint(auth)

if not app.config.DEDICATED_WORKER:

    async def worker():
        from obs.api.process import process_tracks_loop

        # run forever
        await process_tracks_loop(10)

    app.add_task(worker())
