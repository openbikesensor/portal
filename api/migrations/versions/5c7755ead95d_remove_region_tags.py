"""remove region tags

Revision ID: 5c7755ead95d
Revises: f7b21148126a
Create Date: 2023-03-26 09:36:46.808239

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import HSTORE


# revision identifiers, used by Alembic.
revision = "5c7755ead95d"
down_revision = "f7b21148126a"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("region", "tags")


def downgrade():
    op.add_column(
        "region",
        sa.Column("tags", HSTORE, nullable=True),
    )
