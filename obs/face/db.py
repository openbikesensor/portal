from contextvars import ContextVar
from contextlib import asynccontextmanager

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.types import UserDefinedType, BIGINT
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    select,
    DateTime,
    Float,
    Index,
    Enum as SqlEnum,
    func,
)
from sqlalchemy.dialects.postgresql import HSTORE


Base = declarative_base()


engine = ContextVar("engine")
async_session = ContextVar("async_session")


@asynccontextmanager
async def make_session():
    async with async_session.get()() as session:
        yield session


async def init_models():
    async with engine.get().begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


@asynccontextmanager
async def connect_db(url):
    engine_ = create_async_engine(url, echo=False)
    t1 = engine.set(engine_)

    async_session_ = sessionmaker(engine_, class_=AsyncSession, expire_on_commit=False)
    t2 = async_session.set(async_session_)

    yield

    # for AsyncEngine created in function scope, close and
    # clean-up pooled connections
    await engine_.dispose()
    engine.reset(t1)
    async_session.reset(t2)


ZoneType = SqlEnum("rural", "urban", "motorway", name="zone_type")


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
    track_id = Column(String, index=True)
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
