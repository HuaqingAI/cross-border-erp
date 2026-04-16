"""create_product_categories_table

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product_categories",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
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
        sa.CheckConstraint("level IN (1, 2, 3)", name="ck_product_categories_level"),
        sa.ForeignKeyConstraint(["parent_id"], ["product_categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_product_categories_code"),
        "product_categories",
        ["code"],
        unique=True,
    )
    op.create_index(
        op.f("ix_product_categories_level"),
        "product_categories",
        ["level"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_categories_parent_id"),
        "product_categories",
        ["parent_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_categories_sort_order"),
        "product_categories",
        ["sort_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_product_categories_sort_order"), table_name="product_categories")
    op.drop_index(op.f("ix_product_categories_parent_id"), table_name="product_categories")
    op.drop_index(op.f("ix_product_categories_level"), table_name="product_categories")
    op.drop_index(op.f("ix_product_categories_code"), table_name="product_categories")
    op.drop_table("product_categories")
