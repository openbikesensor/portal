"""create enum zone_type

Revision ID: 986c6953e431
Revises: 3856f240bb6d
Create Date: 2022-03-30 21:36:19.888268

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "986c6953e431"
down_revision = "3856f240bb6d"
branch_labels = None
depends_on = None


def _get_enum_type():
    return postgresql.ENUM("rural", "urban", "motorway", name="zone_type")


def upgrade():
    _get_enum_type().create(op.get_bind(), checkfirst=True)


def downgrade():
    _get_enum_type().drop(op.get_bind())
