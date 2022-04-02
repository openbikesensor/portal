"""create extensions

Revision ID: 3856f240bb6d
Revises: a9627f63fbed
Create Date: 2022-03-30 21:31:06.282725

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "3856f240bb6d"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute('CREATE EXTENSION IF NOT EXISTS "hstore";')
    op.execute('CREATE EXTENSION IF NOT EXISTS "postgis";')
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')


def downgrade():
    op.execute('DROP EXTENSION "hstore";')
    op.execute('DROP EXTENSION "postgis";')
    op.execute('DROP EXTENSION "uuid-ossp";')
