"""create_spus_tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "spus",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("level1_category_id", sa.Integer(), nullable=False),
        sa.Column("level2_category_id", sa.Integer(), nullable=False),
        sa.Column("level3_category_id", sa.Integer(), nullable=False),
        sa.Column("customer_warranty_months", sa.Integer(), nullable=False),
        sa.Column("unit", sa.String(length=50), nullable=False),
        sa.Column("restricted_countries", sa.JSON(), nullable=False),
        sa.Column("supplier_name", sa.String(length=100), nullable=False),
        sa.Column("manufacturer_model", sa.String(length=100), nullable=False),
        sa.Column("purchase_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("purchase_warranty_months", sa.Integer(), nullable=True),
        sa.Column("supplier_warranty_notes", sa.String(length=500), nullable=True),
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
        sa.ForeignKeyConstraint(["level1_category_id"], ["product_categories.id"]),
        sa.ForeignKeyConstraint(["level2_category_id"], ["product_categories.id"]),
        sa.ForeignKeyConstraint(["level3_category_id"], ["product_categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_spus_code"), "spus", ["code"], unique=True)
    op.create_index(op.f("ix_spus_name"), "spus", ["name"], unique=False)
    op.create_index(
        op.f("ix_spus_level1_category_id"),
        "spus",
        ["level1_category_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_spus_level2_category_id"),
        "spus",
        ["level2_category_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_spus_level3_category_id"),
        "spus",
        ["level3_category_id"],
        unique=False,
    )
    op.create_index(op.f("ix_spus_supplier_name"), "spus", ["supplier_name"], unique=False)

    op.create_table(
        "spu_invoice_infos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("spu_id", sa.Integer(), nullable=False),
        sa.Column("invoice_name", sa.String(length=100), nullable=False),
        sa.Column("invoice_unit", sa.String(length=50), nullable=False),
        sa.Column("invoice_model", sa.String(length=100), nullable=False),
        sa.Column("company_subject", sa.String(length=100), nullable=False),
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
        sa.ForeignKeyConstraint(["spu_id"], ["spus.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_spu_invoice_infos_spu_id"),
        "spu_invoice_infos",
        ["spu_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_spu_invoice_infos_sort_order"),
        "spu_invoice_infos",
        ["sort_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_spu_invoice_infos_sort_order"), table_name="spu_invoice_infos")
    op.drop_index(op.f("ix_spu_invoice_infos_spu_id"), table_name="spu_invoice_infos")
    op.drop_table("spu_invoice_infos")
    op.drop_index(op.f("ix_spus_supplier_name"), table_name="spus")
    op.drop_index(op.f("ix_spus_level3_category_id"), table_name="spus")
    op.drop_index(op.f("ix_spus_level2_category_id"), table_name="spus")
    op.drop_index(op.f("ix_spus_level1_category_id"), table_name="spus")
    op.drop_index(op.f("ix_spus_name"), table_name="spus")
    op.drop_index(op.f("ix_spus_code"), table_name="spus")
    op.drop_table("spus")
