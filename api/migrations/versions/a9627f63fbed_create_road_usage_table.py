"""create road_usage table

Revision ID: a9627f63fbed
Revises:
Create Date: 2022-03-16 20:26:17.449569

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import Column, Integer, String, ForeignKey, Index, DateTime, Boolean
from sqlalchemy.types import BIGINT

# revision identifiers, used by Alembic.
revision = "a9627f63fbed"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "road_usage",
        Column("id", Integer, autoincrement=True, primary_key=True, index=True),
        Column("track_id", Integer, ForeignKey("track.id", ondelete="CASCADE")),
        Column("hex_hash", String, unique=True, index=True),
        Column("way_id", BIGINT, index=True),
        Column("time", DateTime),
        Column("direction_reversed", Boolean),
        Index("road_usage_segment", "way_id", "direction_reversed"),
    )


def downgrade():
    op.drop_table("road_usage")
