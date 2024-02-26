"""add road bicycles_allowed and cars_allowed

Revision ID: bf8d96f116e7
Revises: 7868aed76122
Create Date: 2024-02-18 17:30:18.163567

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "bf8d96f116e7"
down_revision = "7868aed76122"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "road",
        sa.Column(
            "bicycles_allowed", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    op.add_column(
        "road",
        sa.Column(
            "cars_allowed", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )


def downgrade():
    op.drop_column("road", "bicycles_allowed")
    op.drop_column("road", "cars_allowed")
