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
            "way_id", sa.BIGINT, autoincrement=True, primary_key=True, index=True
        ),
        sa.Column("zone", dbtype("zone_type")),
        sa.Column("name", sa.String),
        sa.Column("geometry", dbtype("GEOMETRY"), index=True),
        sa.Column("directionality", sa.Integer),
        sa.Column("oneway", sa.Boolean),
    )


def downgrade():
    op.drop_table("road")
