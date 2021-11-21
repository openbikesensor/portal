import hashlib
from contextvars import ContextVar
from contextlib import asynccontextmanager
from datetime import datetime
import os
from os.path import join, dirname
import re
import math
import aiofiles
import random
import string
from slugify import slugify

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker as SessionMaker, relationship
from sqlalchemy.types import UserDefinedType, BIGINT, TEXT
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SqlEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    false,
    func,
    select,
    text,
    literal,
)
from sqlalchemy.dialects.postgresql import HSTORE, UUID


Base = declarative_base()


engine = None
sessionmaker = None


@asynccontextmanager
async def make_session():
    async with sessionmaker() as session:
        yield session


async def init_models():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "hstore";'))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "postgis";'))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
        await conn.run_sync(Base.metadata.create_all)


def random_string(length):
    letters = string.ascii_lowercase + string.digits
    return "".join(random.choice(letters) for i in range(length))


@asynccontextmanager
async def connect_db(url):
    global engine, sessionmaker

    engine = create_async_engine(url, echo=False)
    sessionmaker = SessionMaker(engine, class_=AsyncSession, expire_on_commit=False)

    yield engine

    # for AsyncEngine created in function scope, close and
    # clean-up pooled connections
    await engine.dispose()

    engine = None
    sessionmaker = None


ZoneType = SqlEnum("rural", "urban", "motorway", name="zone_type")
ProcessingStatus = SqlEnum(
    "created", "queued", "processing", "complete", "error", name="processing_status"
)


class Geometry(UserDefinedType):
    def get_col_spec(self):
        return "GEOMETRY"

    def bind_expression(self, bindvalue):
        return func.ST_GeomFromGeoJSON(bindvalue, type_=self)

    def column_expression(self, col):
        return func.ST_AsGeoJSON(col, type_=self)


class OvertakingEvent(Base):
    __tablename__ = "overtaking_event"
    __table_args__ = (Index("road_segment", "way_id", "direction_reversed"),)

    id = Column(Integer, autoincrement=True, primary_key=True, index=True)
    track_id = Column(Integer, ForeignKey("track.id", ondelete="CASCADE"))
    hex_hash = Column(String, unique=True, index=True)
    way_id = Column(BIGINT, index=True)

    # whether we were traveling along the way in reverse direction
    direction_reversed = Column(Boolean)

    geometry = Column(Geometry)
    latitude = Column(Float)
    longitude = Column(Float)
    time = Column(DateTime)
    distance_overtaker = Column(Float)
    distance_stationary = Column(Float)
    course = Column(Float)
    speed = Column(Float)

    def __repr__(self):
        return f"<OvertakingEvent {self.id}>"


class Road(Base):
    __tablename__ = "road"
    way_id = Column(BIGINT, primary_key=True, index=True)
    zone = Column(ZoneType)
    name = Column(String)
    geometry = Column(Geometry)
    tags = Column(HSTORE)
    directionality = Column(Integer)


NOW = text("NOW()")


class Track(Base):
    __tablename__ = "track"
    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String, unique=True, nullable=False, index=True)

    created_at = Column(DateTime, nullable=False, server_default=NOW)
    updated_at = Column(DateTime, nullable=False, server_default=NOW, onupdate=NOW)

    title = Column(String)

    processing_status = Column(ProcessingStatus, server_default=literal("created"))
    processing_queued_at = Column(DateTime)
    processed_at = Column(DateTime)

    processing_log = Column(TEXT)

    # Set to true if the user customized the title. Disables auto-generating
    # an updated title when the track is (re-)processed.
    customized_title = Column(Boolean, server_default=false(), nullable=False)

    # A user-provided description of the track. May contain markdown.
    description = Column(TEXT)

    # Whether this track is visible (anonymized) in the public track list or not.
    public = Column(Boolean, server_default=false())

    # Whether this track should be exported to the public track database
    # (after anonymization).
    # include_in_public_database = Column(Boolean, server_default=false())

    # The user agent string, or a part thereof, that was used to upload this
    # track. Usually contains only the OBS version, other user agents are
    # discarded due to being irrelevant.
    uploaded_by_user_agent = Column(String)

    # The name of the original file, as provided during upload. Used for
    # providing a download with the same name, and for display in the
    # frontend.
    original_file_name = Column(String)

    # A hash of the original file's contents. Nobody can upload the same track twice.
    original_file_hash = Column(String, nullable=False)

    author_id = Column(
        Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )

    # Statistics... maybe we'll drop some of this if we can easily compute them from SQL
    recorded_at = Column(DateTime)
    recorded_until = Column(DateTime)
    duration = Column(Float)
    length = Column(Float)
    segments = Column(Integer)
    num_events = Column(Integer)
    num_measurements = Column(Integer)
    num_valid = Column(Integer)

    def to_dict(self, for_user_id=None):
        result = {
            "id": self.id,
            "slug": self.slug,
            "title": self.title,
            "description": self.description,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
            "public": self.public,
            "processingStatus": self.processing_status,
            "recordedAt": self.recorded_at,
            "recordedUntil": self.recorded_until,
            "duration": self.duration,
            "length": self.length,
            "numEvents": self.num_events,
            "numValid": self.num_valid,
            "numMeasurements": self.num_measurements,
        }

        if for_user_id is not None and for_user_id == self.author_id:
            result["uploadedByUserAgent"] = self.uploaded_by_user_agent
            result["originalFileName"] = self.original_file_name

        if self.author:
            result["author"] = self.author.to_dict(for_user_id=for_user_id)

        return result

    def is_visible_to_private(self, user):
        return user is not None and user.id == self.author_id

    def is_visible_to(self, user):
        return self.is_visible_to_private(user) or self.public

    def generate_slug(self, new_title_or_filename=None):
        input_text = (
            new_title_or_filename or self.title or self.original_file_name or "track"
        )
        self.slug = slugify(input_text, separator="_") + "-" + random_string(6)

    async def prevent_duplicates(self, session, file_body):
        hex_hash = hashlib.sha512(file_body).hexdigest()

        duplicate_count = await session.scalar(
            select(func.count())
            .select_from(Track)
            .where(
                Track.original_file_hash == hex_hash
                and Track.author_id == self.author_id
                and Track.id != self.id
            )
        )

        if duplicate_count:
            raise ValueError("duplicate file")

        self.original_file_hash = hex_hash

    async def write_to_original_file(self, config, body):
        mode = "wb" if isinstance(body, bytes) else "wt"

        target = self.get_original_file_path(config)
        os.makedirs(dirname(target), exist_ok=True)
        async with aiofiles.open(target, mode=mode) as f:
            await f.write(body)

    def queue_processing(self):
        self.processing_status = "queued"
        self.processing_queued_at = datetime.utcnow()

    def auto_generate_title(self):
        if self.customized_title:
            return

        # Try to figure out when this file was recorded. Either we have it in then
        # statistics, e.g. after parsing and processing the track, or we can maybe
        # derive it from the filename.
        recorded_at = self.recorded_at

        if not recorded_at and self.original_file_name:
            match = re.match(
                r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}\.[0-9]{2}\.[0-9]{2}",
                self.original_file_name,
            )
            if match:
                try:
                    recorded_at = datetime.fromisoformat(match[0])
                except ValueError:
                    pass

        if recorded_at:
            daytime = _get_daytime(recorded_at)
            self.title = f"{daytime} ride on {recorded_at.strftime('%a, %x')}"
            return

        # Detecting recording date failed, use filename
        if self.original_file_name:
            words = self.original_file_name
            words = re.sub(r"(\.obsdata)?\.csv$", "", words)
            words = re.split(r"\W+", words)
            words[0] = words[0][0].upper() + words[0][1:]
            self.title = " ".join(words)

    @property
    def file_path(self):
        return join(self.author.username, self.slug)

    def get_original_file_path(self, config):
        return join(config.TRACKS_DIR, self.file_path, "original.csv")


class User(Base):
    __tablename__ = "user"
    id = Column(Integer, autoincrement=True, primary_key=True)
    created_at = Column(DateTime, nullable=False, server_default=NOW)
    updated_at = Column(DateTime, nullable=False, server_default=NOW, onupdate=NOW)
    sub = Column(String, unique=True, nullable=False)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, nullable=False)
    bio = Column(TEXT)
    image = Column(String)
    are_tracks_visible_for_all = Column(Boolean, server_default=false(), nullable=False)
    api_key = Column(String)

    # This user can be matched by the email address from the auth service
    # instead of having to match by `sub`. If a matching user logs in, the
    # `sub` is updated to the new sub and this flag is disabled. This is for
    # migrating *to* the external authentication scheme.
    match_by_username_email = Column(Boolean, server_default=false())

    def to_dict(self, for_user_id=None):
        return {
            "username": self.username,
            "bio": self.bio,
            "image": self.image,
        }


class Comment(Base):
    __tablename__ = "comment"
    id = Column(Integer, autoincrement=True, primary_key=True)
    uid = Column(UUID, server_default=func.uuid_generate_v4())

    created_at = Column(DateTime, nullable=False, server_default=NOW)
    updated_at = Column(DateTime, nullable=False, server_default=NOW, onupdate=NOW)

    body = Column(TEXT)

    author_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))

    track_id = Column(Integer, ForeignKey("track.id", ondelete="CASCADE"))

    def to_dict(self, for_user_id=None):
        return {
            "id": self.uid,
            "body": self.body,
            "author": self.author.to_dict(for_user_id=for_user_id),
            "createdAt": self.created_at,
        }


Comment.author = relationship("User", back_populates="authored_comments")
User.authored_comments = relationship(
    "Comment", order_by=Comment.created_at, back_populates="author"
)

Track.author = relationship("User", back_populates="authored_tracks")
User.authored_tracks = relationship(
    "Track", order_by=Track.created_at, back_populates="author"
)

Comment.track = relationship("Track", back_populates="comments")
Track.comments = relationship(
    "Comment", order_by=Comment.created_at, back_populates="track"
)

OvertakingEvent.track = relationship("Track", back_populates="overtaking_events")
Track.overtaking_events = relationship(
    "OvertakingEvent", order_by=OvertakingEvent.time, back_populates="track"
)


# 0..4 Night, 4..10 Morning, 10..14 Noon, 14..18 Afternoon, 18..22 Evening, 22..00 Night
# Two hour intervals
_DAYTIMES = [
    "Night",  # 0h - 2h
    "Night",  # 2h - 4h
    "Morning",  # 4h - 6h
    "Morning",  # 6h - 8h
    "Morning",  # 8h - 10h
    "Noon",  # 10h - 12h
    "Noon",  # 12h - 14h
    "Afternoon",  # 14h - 16h
    "Afternoon",  # 16h - 18h
    "Evening",  # 18h - 20h
    "Evening",  # 20h - 22h
    "Night",  # 22h - 24h
]


def _get_daytime(d):
    return _DAYTIMES[math.floor((d.hour % 24) / 2)]
