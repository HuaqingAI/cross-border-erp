"""create_skus_tables

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "skus",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("spu_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name_zh", sa.String(length=100), nullable=False),
        sa.Column("name_en", sa.String(length=100), nullable=False),
        sa.Column("product_model", sa.String(length=100), nullable=False),
        sa.Column("product_type", sa.String(length=50), nullable=False),
        sa.Column("level1_category_id", sa.Integer(), nullable=False),
        sa.Column("level2_category_id", sa.Integer(), nullable=False),
        sa.Column("level3_category_id", sa.Integer(), nullable=False),
        sa.Column("supplier_name", sa.String(length=100), nullable=False),
        sa.Column("restricted_countries", sa.JSON(), nullable=False),
        sa.Column("customer_warranty_months", sa.Integer(), nullable=False),
        sa.Column("core_params", sa.String(length=500), nullable=False),
        sa.Column(
            "product_status",
            sa.String(length=50),
            nullable=False,
            server_default=sa.text("'上架'"),
        ),
        sa.Column("electrical_params", sa.String(length=100), nullable=True),
        sa.Column("principle", sa.String(length=500), nullable=False),
        sa.Column("usage", sa.String(length=500), nullable=False),
        sa.Column("material", sa.String(length=200), nullable=True),
        sa.Column("unit", sa.String(length=50), nullable=False),
        sa.Column("has_plug", sa.Boolean(), nullable=False),
        sa.Column("is_special", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("special_notes", sa.String(length=1000), nullable=True),
        sa.Column("package_type", sa.String(length=50), nullable=True),
        sa.Column("package_quantity", sa.Integer(), nullable=True),
        sa.Column("customs_hscode", sa.String(length=50), nullable=True),
        sa.Column("customs_supervision_condition", sa.String(length=255), nullable=True),
        sa.Column("customs_declaration_elements", sa.String(length=1000), nullable=True),
        sa.Column("customs_refund_tax_rate", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "customs_info_ready",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
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
        sa.ForeignKeyConstraint(["level1_category_id"], ["product_categories.id"]),
        sa.ForeignKeyConstraint(["level2_category_id"], ["product_categories.id"]),
        sa.ForeignKeyConstraint(["level3_category_id"], ["product_categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_skus_spu_id"), "skus", ["spu_id"], unique=False)
    op.create_index(op.f("ix_skus_code"), "skus", ["code"], unique=True)
    op.create_index(op.f("ix_skus_name_zh"), "skus", ["name_zh"], unique=False)
    op.create_index(op.f("ix_skus_name_en"), "skus", ["name_en"], unique=False)
    op.create_index(op.f("ix_skus_product_type"), "skus", ["product_type"], unique=False)
    op.create_index(
        op.f("ix_skus_level1_category_id"),
        "skus",
        ["level1_category_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_skus_level2_category_id"),
        "skus",
        ["level2_category_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_skus_level3_category_id"),
        "skus",
        ["level3_category_id"],
        unique=False,
    )
    op.create_index(op.f("ix_skus_supplier_name"), "skus", ["supplier_name"], unique=False)
    op.create_index(op.f("ix_skus_product_status"), "skus", ["product_status"], unique=False)

    op.create_table(
        "sku_package_details",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sku_id", sa.Integer(), nullable=False),
        sa.Column("net_weight_kg", sa.Numeric(10, 3), nullable=True),
        sa.Column("gross_weight_kg", sa.Numeric(10, 3), nullable=True),
        sa.Column("length_cm", sa.Numeric(10, 3), nullable=True),
        sa.Column("width_cm", sa.Numeric(10, 3), nullable=True),
        sa.Column("height_cm", sa.Numeric(10, 3), nullable=True),
        sa.Column("volume_cbm", sa.Numeric(10, 3), nullable=True),
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
    op.create_index(
        op.f("ix_sku_package_details_sku_id"),
        "sku_package_details",
        ["sku_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_sku_package_details_sort_order"),
        "sku_package_details",
        ["sort_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_sku_package_details_sort_order"), table_name="sku_package_details")
    op.drop_index(op.f("ix_sku_package_details_sku_id"), table_name="sku_package_details")
    op.drop_table("sku_package_details")
    op.drop_index(op.f("ix_skus_product_status"), table_name="skus")
    op.drop_index(op.f("ix_skus_supplier_name"), table_name="skus")
    op.drop_index(op.f("ix_skus_level3_category_id"), table_name="skus")
    op.drop_index(op.f("ix_skus_level2_category_id"), table_name="skus")
    op.drop_index(op.f("ix_skus_level1_category_id"), table_name="skus")
    op.drop_index(op.f("ix_skus_product_type"), table_name="skus")
    op.drop_index(op.f("ix_skus_name_en"), table_name="skus")
    op.drop_index(op.f("ix_skus_name_zh"), table_name="skus")
    op.drop_index(op.f("ix_skus_code"), table_name="skus")
    op.drop_index(op.f("ix_skus_spu_id"), table_name="skus")
    op.drop_table("skus")
