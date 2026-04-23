"""create_enums_table

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "enums",
        sa.Column("enum_group", sa.String(length=50), nullable=False),
        sa.Column("enum_key", sa.String(length=100), nullable=False),
        sa.Column("enum_value", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "active_enum_group",
            sa.String(length=50),
            sa.Computed("CASE WHEN deleted_at IS NULL THEN enum_group ELSE NULL END"),
            nullable=True,
        ),
        sa.Column(
            "active_enum_key",
            sa.String(length=100),
            sa.Computed("CASE WHEN deleted_at IS NULL THEN enum_key ELSE NULL END"),
            nullable=True,
        ),
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_enums_enum_group"), "enums", ["enum_group"], unique=False)
    op.create_index(op.f("ix_enums_enum_key"), "enums", ["enum_key"], unique=False)
    op.create_index(op.f("ix_enums_is_enabled"), "enums", ["is_enabled"], unique=False)
    op.create_index(op.f("ix_enums_sort_order"), "enums", ["sort_order"], unique=False)
    op.create_index(
        "ix_enums_active_group_key",
        "enums",
        ["active_enum_group", "active_enum_key"],
        unique=True,
    )

    enums_table = sa.table(
        "enums",
        sa.column("enum_group", sa.String),
        sa.column("enum_key", sa.String),
        sa.column("enum_value", sa.String),
        sa.column("description", sa.String),
        sa.column("sort_order", sa.Integer),
        sa.column("is_enabled", sa.Boolean),
    )

    seed_rows = [
        ("unit", "个", "个", "系统默认单位", 10, True),
        ("unit", "件", "件", "系统默认单位", 20, True),
        ("unit", "双", "双", "系统默认单位", 30, True),
        ("unit", "台", "台", "系统默认单位", 40, True),
        ("product_type", "主品", "主品", "系统默认产品类型", 10, True),
        ("product_type", "配件", "配件", "系统默认产品类型", 20, True),
        ("product_type", "耗材", "耗材", "系统默认产品类型", 30, True),
        ("product_status", "上架", "上架", "系统默认产品状态", 10, True),
        ("product_status", "下架可售", "下架可售", "系统默认产品状态", 20, True),
        ("product_status", "下架不可售", "下架不可售", "系统默认产品状态", 30, True),
        ("product_status", "临拓", "临拓", "系统默认产品状态", 40, True),
        ("package_type", "纸箱", "纸箱", "系统默认包装类型", 10, True),
        ("package_type", "木箱", "木箱", "系统默认包装类型", 20, True),
        ("package_type", "托盘", "托盘", "系统默认包装类型", 30, True),
        ("electrical_params", "220V/50Hz", "220V/50Hz", "系统默认电参数", 10, True),
        ("electrical_params", "110V/60Hz", "110V/60Hz", "系统默认电参数", 20, True),
        ("electrical_params", "100-240V~50/60Hz", "100-240V~50/60Hz", "系统默认电参数", 30, True),
        ("certificate_type", "CE", "CE", "系统默认认证类型", 10, True),
        ("certificate_type", "FDA", "FDA", "系统默认认证类型", 20, True),
        ("certificate_type", "ISO13485", "ISO13485", "系统默认认证类型", 30, True),
        ("faq_question_type", "售后", "售后", "系统默认 FAQ 类型", 10, True),
        ("faq_question_type", "安装", "安装", "系统默认 FAQ 类型", 20, True),
        ("faq_question_type", "使用", "使用", "系统默认 FAQ 类型", 30, True),
        ("faq_question_type", "配置", "配置", "系统默认 FAQ 类型", 40, True),
        ("faq_question_type", "其他", "其他", "系统默认 FAQ 类型", 50, True),
        ("document_type", "产品手册", "产品手册", "系统默认资料类型", 10, True),
        ("document_type", "技术参数", "技术参数", "系统默认资料类型", 20, True),
        ("document_type", "使用说明", "使用说明", "系统默认资料类型", 30, True),
        ("document_type", "安装说明", "安装说明", "系统默认资料类型", 40, True),
        ("document_type", "培训资料", "培训资料", "系统默认资料类型", 50, True),
        ("document_type", "其他", "其他", "系统默认资料类型", 60, True),
        ("currency", "CNY", "CNY", "系统默认币种", 10, True),
        ("currency", "USD", "USD", "系统默认币种", 20, True),
        ("currency", "EUR", "EUR", "系统默认币种", 30, True),
        ("currency", "JPY", "JPY", "系统默认币种", 40, True),
        ("country_region", "GLOBAL", "全球", "系统保留默认区域", 0, True),
        ("country_region", "CN", "中国", "系统默认国家/地区", 10, True),
        ("country_region", "US", "美国", "系统默认国家/地区", 20, True),
        ("country_region", "DE", "德国", "系统默认国家/地区", 30, True),
        ("country_region", "FR", "法国", "系统默认国家/地区", 40, True),
        ("country_region", "JP", "日本", "系统默认国家/地区", 50, True),
        ("country_region", "IR", "伊朗", "系统默认国家/地区", 60, True),
        ("country_region", "KP", "朝鲜", "系统默认国家/地区", 70, True),
    ]
    op.bulk_insert(
        enums_table,
        [
            {
                "enum_group": enum_group,
                "enum_key": enum_key,
                "enum_value": enum_value,
                "description": description,
                "sort_order": sort_order,
                "is_enabled": is_enabled,
            }
            for enum_group, enum_key, enum_value, description, sort_order, is_enabled in seed_rows
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_enums_active_group_key", table_name="enums")
    op.drop_index(op.f("ix_enums_sort_order"), table_name="enums")
    op.drop_index(op.f("ix_enums_is_enabled"), table_name="enums")
    op.drop_index(op.f("ix_enums_enum_key"), table_name="enums")
    op.drop_index(op.f("ix_enums_enum_group"), table_name="enums")
    op.drop_table("enums")
