"""create table comment

Revision ID: 9336eef458e7
Revises: 9d8c8c38a1d0
Create Date: 2022-03-30 21:37:02.080429

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "9336eef458e7"
down_revision = "d66baafab5ec"
branch_labels = None
depends_on = None


def upgrade():
    NOW = sa.text("NOW()")

    op.create_table(
        "comment",
        sa.Column("id", sa.Integer, autoincrement=True, primary_key=True),
        sa.Column("uid", UUID, server_default=sa.func.uuid_generate_v4()),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=NOW),
        sa.Column(
            "updated_at", sa.DateTime, nullable=False, server_default=NOW, onupdate=NOW
        ),
        sa.Column("body", sa.TEXT),
        sa.Column(
            "author_id", sa.Integer, sa.ForeignKey("user.id", ondelete="CASCADE")
        ),
        sa.Column(
            "track_id", sa.Integer, sa.ForeignKey("track.id", ondelete="CASCADE")
        ),
    )


def downgrade():
    op.drop_table("comment")
