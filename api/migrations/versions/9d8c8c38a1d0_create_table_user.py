"""create table user

Revision ID: 9d8c8c38a1d0
Revises: d66baafab5ec
Create Date: 2022-03-30 21:36:59.375149

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "9d8c8c38a1d0"
down_revision = "35e7f1768f9b"
branch_labels = None
depends_on = None


def upgrade():
    NOW = sa.text("NOW()")

    op.create_table(
        "user",
        sa.Column("id", sa.Integer, autoincrement=True, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=NOW),
        sa.Column(
            "updated_at", sa.DateTime, nullable=False, server_default=NOW, onupdate=NOW
        ),
        sa.Column("sub", sa.String, unique=True, nullable=False),
        sa.Column("username", sa.String, unique=True, nullable=False),
        sa.Column("email", sa.String, nullable=False),
        sa.Column("bio", sa.TEXT),
        sa.Column("image", sa.String),
        sa.Column(
            "are_tracks_visible_for_all",
            sa.Boolean,
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column("api_key", sa.String),
        sa.Column("match_by_username_email", sa.Boolean, server_default=sa.false()),
    )


def downgrade():
    op.drop_table("user")
