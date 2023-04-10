"""transform overtaking_event geometry to 3857

Revision ID: 587e69ecb466
Revises: f4b0f460254d
Create Date: 2023-04-01 14:30:49.927505

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "587e69ecb466"
down_revision = "f4b0f460254d"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE overtaking_event SET geometry = ST_Transform(geometry, 3857);")
    op.execute(
        "ALTER TABLE overtaking_event ALTER COLUMN geometry TYPE geometry(POINT, 3857);"
    )


def downgrade():
    op.execute(
        "ALTER TABLE overtaking_event ALTER COLUMN overtaking_event.geometry TYPE geometry;"
    )
    op.execute("UPDATE overtaking_event SET geometry = ST_Transform(geometry, 4326);")
