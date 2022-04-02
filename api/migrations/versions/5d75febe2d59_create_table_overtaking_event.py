"""create table overtaking_event

Revision ID: 5d75febe2d59
Revises: 920aed1450c9
Create Date: 2022-03-30 21:36:37.687080

"""
from alembic import op
import sqlalchemy as sa

from migrations.utils import dbtype

# revision identifiers, used by Alembic.
revision = "5d75febe2d59"
down_revision = "9336eef458e7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "overtaking_event",
        sa.Column("id", sa.Integer, autoincrement=True, primary_key=True, index=True),
        sa.Column(
            "track_id", sa.Integer, sa.ForeignKey("track.id", ondelete="CASCADE")
        ),
        sa.Column("hex_hash", sa.String, unique=True, index=True),
        sa.Column("way_id", sa.BIGINT, index=True),
        sa.Column("direction_reversed", sa.Boolean),
        sa.Column("geometry", dbtype("GEOMETRY")),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),
        sa.Column("time", sa.DateTime),
        sa.Column("distance_overtaker", sa.Float),
        sa.Column("distance_stationary", sa.Float),
        sa.Column("course", sa.Float),
        sa.Column("speed", sa.Float),
        sa.Index("road_segment", "way_id", "direction_reversed"),
    )


def downgrade():
    op.drop_table("overtaking_event")
