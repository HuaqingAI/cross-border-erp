"""create_faqs_table

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "faqs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("spu_id", sa.Integer(), nullable=True),
        sa.Column("question_type", sa.String(length=50), nullable=True),
        sa.Column("question", sa.String(length=200), nullable=False),
        sa.Column("answer", sa.String(length=200), nullable=False),
        sa.Column("attachment_object_key", sa.String(length=255), nullable=True),
        sa.Column("attachment_file_url", sa.String(length=500), nullable=True),
        sa.Column("attachment_file_name", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["spu_id"], ["spus.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_faqs_spu_id"), "faqs", ["spu_id"], unique=False)
    op.create_index(
        op.f("ix_faqs_question_type"),
        "faqs",
        ["question_type"],
        unique=False,
    )
    op.create_index(op.f("ix_faqs_question"), "faqs", ["question"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_faqs_question"), table_name="faqs")
    op.drop_index(op.f("ix_faqs_question_type"), table_name="faqs")
    op.drop_index(op.f("ix_faqs_spu_id"), table_name="faqs")
    op.drop_table("faqs")
