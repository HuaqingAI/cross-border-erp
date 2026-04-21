"""create_product_documents_tables

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    content_html_type = sa.Text().with_variant(mysql.LONGTEXT(), "mysql")

    op.create_table(
        "product_documents",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("document_type", sa.String(length=50), nullable=True),
        sa.Column("content_html", content_html_type, nullable=True),
        sa.Column("ownership_type", sa.String(length=20), nullable=False),
        sa.Column("applicable_countries", sa.JSON(), nullable=False),
        sa.Column("remarks", sa.String(length=1000), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_product_documents_name"),
        "product_documents",
        ["name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_documents_document_type"),
        "product_documents",
        ["document_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_documents_ownership_type"),
        "product_documents",
        ["ownership_type"],
        unique=False,
    )

    op.create_table(
        "product_document_sku_assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("product_document_id", sa.Integer(), nullable=False),
        sa.Column("sku_id", sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(["product_document_id"], ["product_documents.id"]),
        sa.ForeignKeyConstraint(["sku_id"], ["skus.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_product_document_sku_assignments_product_document_id"),
        "product_document_sku_assignments",
        ["product_document_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_document_sku_assignments_sku_id"),
        "product_document_sku_assignments",
        ["sku_id"],
        unique=False,
    )

    op.create_table(
        "product_document_category_assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("product_document_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(["product_document_id"], ["product_documents.id"]),
        sa.ForeignKeyConstraint(["category_id"], ["product_categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_product_document_category_assignments_product_document_id"),
        "product_document_category_assignments",
        ["product_document_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_document_category_assignments_category_id"),
        "product_document_category_assignments",
        ["category_id"],
        unique=False,
    )

    op.create_table(
        "product_document_attachments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("product_document_id", sa.Integer(), nullable=False),
        sa.Column("object_key", sa.String(length=255), nullable=False),
        sa.Column("file_url", sa.String(length=500), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(["product_document_id"], ["product_documents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_product_document_attachments_product_document_id"),
        "product_document_attachments",
        ["product_document_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_document_attachments_object_key"),
        "product_document_attachments",
        ["object_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_document_attachments_sort_order"),
        "product_document_attachments",
        ["sort_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_product_document_attachments_sort_order"),
        table_name="product_document_attachments",
    )
    op.drop_index(
        op.f("ix_product_document_attachments_object_key"),
        table_name="product_document_attachments",
    )
    op.drop_index(
        op.f("ix_product_document_attachments_product_document_id"),
        table_name="product_document_attachments",
    )
    op.drop_table("product_document_attachments")
    op.drop_index(
        op.f("ix_product_document_category_assignments_category_id"),
        table_name="product_document_category_assignments",
    )
    op.drop_index(
        op.f("ix_product_document_category_assignments_product_document_id"),
        table_name="product_document_category_assignments",
    )
    op.drop_table("product_document_category_assignments")
    op.drop_index(
        op.f("ix_product_document_sku_assignments_sku_id"),
        table_name="product_document_sku_assignments",
    )
    op.drop_index(
        op.f("ix_product_document_sku_assignments_product_document_id"),
        table_name="product_document_sku_assignments",
    )
    op.drop_table("product_document_sku_assignments")
    op.drop_index(
        op.f("ix_product_documents_ownership_type"),
        table_name="product_documents",
    )
    op.drop_index(
        op.f("ix_product_documents_document_type"),
        table_name="product_documents",
    )
    op.drop_index(op.f("ix_product_documents_name"), table_name="product_documents")
    op.drop_table("product_documents")
