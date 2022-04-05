"""add road column has_cars

Revision ID: ddde1cdc767b
Revises: a049e5eb24dd
Create Date: 2022-04-03 20:13:22.874195

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "ddde1cdc767b"
down_revision = "a049e5eb24dd"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("road", sa.Column("has_cars", sa.Boolean))


def downgrade():
    op.drop_column("road", "has_cars")
