"""add_overtaking_event_index


Revision ID: 7868aed76122
Revises: 587e69ecb466
Create Date: 2023-07-16 13:37:17.694079

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7868aed76122'
down_revision = '587e69ecb466'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE INDEX IF NOT EXISTS ix_overtaking_event_geometry ON overtaking_event using GIST(geometry);")


def downgrade():
    op.drop_index("ix_overtaking_event_geometry")

