"""add user display_name

Revision ID: 99a3d2eb08f9
Revises: a9627f63fbed
Create Date: 2022-09-13 07:30:18.747880

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "99a3d2eb08f9"
down_revision = "a9627f63fbed"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user", sa.Column("display_name", sa.String, nullable=True), schema="public"
    )


def downgrade():
    op.drop_column("user", "display_name", schema="public")
