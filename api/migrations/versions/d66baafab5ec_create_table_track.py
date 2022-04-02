"""create table track

Revision ID: d66baafab5ec
Revises: 35e7f1768f9b
Create Date: 2022-03-30 21:36:54.848452

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from migrations.utils import dbtype

# revision identifiers, used by Alembic.
revision = "d66baafab5ec"
down_revision = "9d8c8c38a1d0"
branch_labels = None
depends_on = None


def upgrade():
    NOW = sa.text("NOW()")

    op.create_table(
        "track",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String, unique=True, nullable=False, index=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=NOW),
        sa.Column(
            "updated_at", sa.DateTime, nullable=False, server_default=NOW, onupdate=NOW
        ),
        sa.Column("title", sa.String),
        sa.Column(
            "processing_status",
            dbtype("processing_status"),
            server_default=sa.literal("created"),
        ),
        sa.Column("processing_queued_at", sa.DateTime),
        sa.Column("processed_at", sa.DateTime),
        sa.Column("processing_log", sa.TEXT),
        sa.Column(
            "customized_title", sa.Boolean, server_default=sa.false(), nullable=False
        ),
        sa.Column("description", sa.TEXT),
        sa.Column("public", sa.Boolean, server_default=sa.false()),
        sa.Column("uploaded_by_user_agent", sa.String),
        sa.Column("original_file_name", sa.String),
        sa.Column("original_file_hash", sa.String, nullable=False),
        sa.Column(
            "author_id",
            sa.Integer,
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("recorded_at", sa.DateTime),
        sa.Column("recorded_until", sa.DateTime),
        sa.Column("duration", sa.Float),
        sa.Column("length", sa.Float),
        sa.Column("segments", sa.Integer),
        sa.Column("num_events", sa.Integer),
        sa.Column("num_measurements", sa.Integer),
        sa.Column("num_valid", sa.Integer),
    )


def downgrade():
    op.drop_table("track")
