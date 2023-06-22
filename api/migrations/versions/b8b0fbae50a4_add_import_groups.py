"""add import groups

Revision ID: b8b0fbae50a4
Revises: f7b21148126a
Create Date: 2023-03-26 09:41:36.621203

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b8b0fbae50a4"
down_revision = "f7b21148126a"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "road",
        sa.Column("import_group", sa.String(), nullable=True),
    )
    op.add_column(
        "region",
        sa.Column("import_group", sa.String(), nullable=True),
    )

    # Set existing to "osm2pgsql"
    road = sa.table("road", sa.column("import_group", sa.String))
    op.execute(road.update().values(import_group="osm2pgsql"))

    region = sa.table("region", sa.column("import_group", sa.String))
    op.execute(region.update().values(import_group="osm2pgsql"))


def downgrade():
    op.drop_column("road", "import_group")
    op.drop_column("region", "import_group")
