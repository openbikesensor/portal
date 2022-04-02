"""create enum processing_status

Revision ID: 920aed1450c9
Revises: 986c6953e431
Create Date: 2022-03-30 21:36:25.896192

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "920aed1450c9"
down_revision = "986c6953e431"
branch_labels = None
depends_on = None


def _get_enum_type():
    return postgresql.ENUM(
        "created", "queued", "processing", "complete", "error", name="processing_status"
    )


def upgrade():
    _get_enum_type().create(op.get_bind(), checkfirst=True)


def downgrade():
    _get_enum_type().drop(op.get_bind())
