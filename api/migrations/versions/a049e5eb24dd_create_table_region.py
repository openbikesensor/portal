"""create table region

Revision ID: a049e5eb24dd
Revises: a9627f63fbed
Create Date: 2022-04-02 21:28:43.124521

"""
from alembic import op
import sqlalchemy as sa

from migrations.utils import dbtype


# revision identifiers, used by Alembic.
revision = "a049e5eb24dd"
down_revision = "a9627f63fbed"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "region",
        sa.Column(
            "way_id", sa.BIGINT, autoincrement=True, primary_key=True, index=True
        ),
        sa.Column("zone", dbtype("zone_type")),
        sa.Column("name", sa.String),
        sa.Column("geometry", dbtype("GEOMETRY"), index=True),
        sa.Column("directionality", sa.Integer),
        sa.Column("oenway", sa.Boolean),
    )


def downgrade():
    op.drop_table("region")