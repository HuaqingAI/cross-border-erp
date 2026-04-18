"""create_sku_images_table

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sku_images",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sku_id", sa.Integer(), nullable=False),
        sa.Column("object_key", sa.String(length=255), nullable=False),
        sa.Column("file_url", sa.String(length=500), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
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
        sa.ForeignKeyConstraint(["sku_id"], ["skus.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sku_images_sku_id"), "sku_images", ["sku_id"], unique=False)
    op.create_index(op.f("ix_sku_images_object_key"), "sku_images", ["object_key"], unique=True)
    op.create_index(op.f("ix_sku_images_sort_order"), "sku_images", ["sort_order"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_sku_images_sort_order"), table_name="sku_images")
    op.drop_index(op.f("ix_sku_images_object_key"), table_name="sku_images")
    op.drop_index(op.f("ix_sku_images_sku_id"), table_name="sku_images")
    op.drop_table("sku_images")
