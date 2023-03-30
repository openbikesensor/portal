"""add osm id indexes

Revision ID: f4b0f460254d
Revises: b8b0fbae50a4
Create Date: 2023-03-30 10:56:22.066768

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f4b0f460254d"
down_revision = "b8b0fbae50a4"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE INDEX IF NOT EXISTS ix_road_way_id ON road (way_id);")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_region_relation_id ON region (relation_id);"
    )


def downgrade():
    op.drop_index("ix_road_way_id")
    op.drop_index("ix_region_relation_id")
