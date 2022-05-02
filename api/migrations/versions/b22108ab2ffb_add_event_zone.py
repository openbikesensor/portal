"""add event zone

Revision ID: b22108ab2ffb
Revises: a9627f63fbed
Create Date: 2022-04-30 19:06:11.472579

"""
from alembic import op
import sqlalchemy as sa

from migrations.utils import dbtype

# revision identifiers, used by Alembic.
revision = 'b22108ab2ffb'
down_revision = 'a9627f63fbed'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("overtaking_event",  sa.Column("zone", dbtype("zone_type")), )


def downgrade():
    op.drop_column("overtaking_event", "zone")
