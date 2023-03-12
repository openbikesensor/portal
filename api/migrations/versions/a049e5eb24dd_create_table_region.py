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
down_revision = "99a3d2eb08f9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "region",
        sa.Column(
            "relation_id", sa.BIGINT, autoincrement=True, primary_key=True, index=True
        ),
        sa.Column("name", sa.String),
        sa.Column("geometry", dbtype("GEOMETRY"), index=True),
        sa.Column("admin_level", sa.Integer, index=True),
        sa.Column("tags", dbtype("HSTORE")),
    )


def downgrade():
    op.drop_table("region")
