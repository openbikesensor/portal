"""create table road

Revision ID: 35e7f1768f9b
Revises: 5d75febe2d59
Create Date: 2022-03-30 21:36:48.157457

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from migrations.utils import dbtype

# revision identifiers, used by Alembic.
revision = "35e7f1768f9b"
down_revision = "920aed1450c9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "road",
        sa.Column(
            "way_id", sa.BIGINT, primary_key=True, index=True, autoincrement=False
        ),
        sa.Column("zone", dbtype("zone_type")),
        sa.Column("name", sa.Text),
        sa.Column("geometry", dbtype("geometry(LINESTRING,3857)")),
        sa.Column("directionality", sa.Integer),
        sa.Column("oneway", sa.Boolean),
    )
    op.execute('CREATE INDEX ix_road_geometry ON road USING GIST (geometry) WITH (FILLFACTOR=100);')


def downgrade():
    op.drop_table("road")
