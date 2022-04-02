"""create table road_usage

Revision ID: a9627f63fbed
Revises:
Create Date: 2022-03-16 20:26:17.449569

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a9627f63fbed"
down_revision = "5d75febe2d59"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "road_usage",
        sa.Column("id", sa.Integer, autoincrement=True, primary_key=True, index=True),
        sa.Column(
            "track_id", sa.Integer, sa.ForeignKey("track.id", ondelete="CASCADE")
        ),
        sa.Column("hex_hash", sa.String, unique=True, index=True),
        sa.Column("way_id", sa.BIGINT, index=True),
        sa.Column("time", sa.DateTime),
        sa.Column("direction_reversed", sa.Boolean),
        sa.Index("road_usage_segment", "way_id", "direction_reversed"),
    )


def downgrade():
    op.drop_table("road_usage")
