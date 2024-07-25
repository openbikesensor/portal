"""add-track-geometry

Revision ID: 21a1d1802b52
Revises: 7868aed76122
Create Date: 2024-03-12 18:47:46.990187

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "21a1d1802b52"
down_revision = "7868aed76122"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE track ADD COLUMN geometry geometry(LineString, 3857);")


def downgrade():
    op.drop_column("track", "geometry")
