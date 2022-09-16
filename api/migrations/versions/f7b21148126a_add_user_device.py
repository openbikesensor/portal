"""add user_device

Revision ID: f7b21148126a
Revises: a9627f63fbed
Create Date: 2022-09-15 17:48:06.764342

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f7b21148126a"
down_revision = "a049e5eb24dd"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user_device",
        sa.Column("id", sa.Integer, autoincrement=True, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("user.id", ondelete="CASCADE")),
        sa.Column("identifier", sa.String, nullable=False),
        sa.Column("display_name", sa.String, nullable=True),
        sa.Index("user_id_identifier", "user_id", "identifier", unique=True),
    )
    op.add_column(
        "track",
        sa.Column(
            "user_device_id",
            sa.Integer,
            sa.ForeignKey("user_device.id", ondelete="RESTRICT"),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("track", "user_device_id")
    op.drop_table("user_device")
