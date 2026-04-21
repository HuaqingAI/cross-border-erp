"""create_prices_tables

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "prices",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sku_id", sa.Integer(), nullable=False),
        sa.Column("sku_code", sa.String(length=50), nullable=False),
        sa.Column("sku_name_zh", sa.String(length=100), nullable=False),
        sa.Column("sku_name_en", sa.String(length=100), nullable=False),
        sa.Column("spu_id", sa.Integer(), nullable=False),
        sa.Column("spu_code", sa.String(length=50), nullable=False),
        sa.Column("spu_name", sa.String(length=100), nullable=False),
        sa.Column("level1_category_id", sa.Integer(), nullable=False),
        sa.Column("level1_category_code", sa.String(length=50), nullable=False),
        sa.Column("level1_category_name", sa.String(length=100), nullable=False),
        sa.Column("level2_category_id", sa.Integer(), nullable=False),
        sa.Column("level2_category_code", sa.String(length=50), nullable=False),
        sa.Column("level2_category_name", sa.String(length=100), nullable=False),
        sa.Column("level3_category_id", sa.Integer(), nullable=False),
        sa.Column("level3_category_code", sa.String(length=50), nullable=False),
        sa.Column("level3_category_name", sa.String(length=100), nullable=False),
        sa.Column("purchase_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("supplier_name", sa.String(length=100), nullable=False),
        sa.Column("product_model", sa.String(length=100), nullable=False),
        sa.Column("product_status", sa.String(length=50), nullable=False),
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
        sa.Column(
            "active_sku_id",
            sa.Integer(),
            sa.Computed("CASE WHEN deleted_at IS NULL THEN sku_id ELSE NULL END"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["sku_id"], ["skus.id"]),
        sa.ForeignKeyConstraint(["spu_id"], ["spus.id"]),
        sa.ForeignKeyConstraint(["level1_category_id"], ["product_categories.id"]),
        sa.ForeignKeyConstraint(["level2_category_id"], ["product_categories.id"]),
        sa.ForeignKeyConstraint(["level3_category_id"], ["product_categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_prices_sku_id"), "prices", ["sku_id"], unique=False)
    op.create_index(op.f("ix_prices_sku_code"), "prices", ["sku_code"], unique=False)
    op.create_index(op.f("ix_prices_sku_name_zh"), "prices", ["sku_name_zh"], unique=False)
    op.create_index(op.f("ix_prices_sku_name_en"), "prices", ["sku_name_en"], unique=False)
    op.create_index(op.f("ix_prices_spu_id"), "prices", ["spu_id"], unique=False)
    op.create_index(op.f("ix_prices_spu_code"), "prices", ["spu_code"], unique=False)
    op.create_index(op.f("ix_prices_spu_name"), "prices", ["spu_name"], unique=False)
    op.create_index(op.f("ix_prices_level1_category_id"), "prices", ["level1_category_id"], unique=False)
    op.create_index(op.f("ix_prices_level2_category_id"), "prices", ["level2_category_id"], unique=False)
    op.create_index(op.f("ix_prices_level3_category_id"), "prices", ["level3_category_id"], unique=False)
    op.create_index(op.f("ix_prices_supplier_name"), "prices", ["supplier_name"], unique=False)
    op.create_index(op.f("ix_prices_product_status"), "prices", ["product_status"], unique=False)
    op.create_index(
        op.f("ix_prices_active_sku_id"),
        "prices",
        ["active_sku_id"],
        unique=True,
    )

    op.create_table(
        "price_regions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("price_id", sa.Integer(), nullable=False),
        sa.Column("country_code", sa.String(length=20), nullable=False),
        sa.Column("country_name", sa.String(length=100), nullable=False),
        sa.Column("currency", sa.String(length=20), nullable=False),
        sa.Column("sale_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("list_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("remarks", sa.String(length=500), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
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
        sa.Column(
            "active_country_code",
            sa.String(length=20),
            sa.Computed("CASE WHEN deleted_at IS NULL THEN country_code ELSE NULL END"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["price_id"], ["prices.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_price_regions_price_id"), "price_regions", ["price_id"], unique=False)
    op.create_index(op.f("ix_price_regions_country_code"), "price_regions", ["country_code"], unique=False)
    op.create_index(op.f("ix_price_regions_sort_order"), "price_regions", ["sort_order"], unique=False)
    op.create_index(
        op.f("ix_price_regions_price_id_active_country_code"),
        "price_regions",
        ["price_id", "active_country_code"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_price_regions_price_id_active_country_code"),
        table_name="price_regions",
    )
    op.drop_index(op.f("ix_price_regions_sort_order"), table_name="price_regions")
    op.drop_index(op.f("ix_price_regions_country_code"), table_name="price_regions")
    op.drop_index(op.f("ix_price_regions_price_id"), table_name="price_regions")
    op.drop_table("price_regions")

    op.drop_index(op.f("ix_prices_product_status"), table_name="prices")
    op.drop_index(op.f("ix_prices_supplier_name"), table_name="prices")
    op.drop_index(op.f("ix_prices_active_sku_id"), table_name="prices")
    op.drop_index(op.f("ix_prices_level3_category_id"), table_name="prices")
    op.drop_index(op.f("ix_prices_level2_category_id"), table_name="prices")
    op.drop_index(op.f("ix_prices_level1_category_id"), table_name="prices")
    op.drop_index(op.f("ix_prices_spu_name"), table_name="prices")
    op.drop_index(op.f("ix_prices_spu_code"), table_name="prices")
    op.drop_index(op.f("ix_prices_spu_id"), table_name="prices")
    op.drop_index(op.f("ix_prices_sku_name_en"), table_name="prices")
    op.drop_index(op.f("ix_prices_sku_name_zh"), table_name="prices")
    op.drop_index(op.f("ix_prices_sku_code"), table_name="prices")
    op.drop_index(op.f("ix_prices_sku_id"), table_name="prices")
    op.drop_table("prices")
