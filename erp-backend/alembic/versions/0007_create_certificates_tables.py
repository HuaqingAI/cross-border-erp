"""create_certificates_tables

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "certificates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("certificate_no", sa.String(length=100), nullable=False),
        sa.Column("certificate_type", sa.String(length=50), nullable=False),
        sa.Column("issuing_authority", sa.String(length=100), nullable=False),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=False),
        sa.Column("ownership_type", sa.String(length=20), nullable=False),
        sa.Column("file_object_key", sa.String(length=255), nullable=True),
        sa.Column("file_url", sa.String(length=500), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=True),
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
    op.create_index(op.f("ix_certificates_name"), "certificates", ["name"], unique=False)
    op.create_index(
        op.f("ix_certificates_certificate_no"),
        "certificates",
        ["certificate_no"],
        unique=True,
    )
    op.create_index(
        op.f("ix_certificates_certificate_type"),
        "certificates",
        ["certificate_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_certificates_valid_to"),
        "certificates",
        ["valid_to"],
        unique=False,
    )
    op.create_index(
        op.f("ix_certificates_ownership_type"),
        "certificates",
        ["ownership_type"],
        unique=False,
    )

    op.create_table(
        "certificate_spu_assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("certificate_id", sa.Integer(), nullable=False),
        sa.Column("spu_id", sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(["certificate_id"], ["certificates.id"]),
        sa.ForeignKeyConstraint(["spu_id"], ["spus.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_certificate_spu_assignments_certificate_id"),
        "certificate_spu_assignments",
        ["certificate_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_certificate_spu_assignments_spu_id"),
        "certificate_spu_assignments",
        ["spu_id"],
        unique=False,
    )

    op.create_table(
        "certificate_category_assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("certificate_id", sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(["certificate_id"], ["certificates.id"]),
        sa.ForeignKeyConstraint(["category_id"], ["product_categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_certificate_category_assignments_certificate_id"),
        "certificate_category_assignments",
        ["certificate_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_certificate_category_assignments_category_id"),
        "certificate_category_assignments",
        ["category_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_certificate_category_assignments_category_id"),
        table_name="certificate_category_assignments",
    )
    op.drop_index(
        op.f("ix_certificate_category_assignments_certificate_id"),
        table_name="certificate_category_assignments",
    )
    op.drop_table("certificate_category_assignments")
    op.drop_index(
        op.f("ix_certificate_spu_assignments_spu_id"),
        table_name="certificate_spu_assignments",
    )
    op.drop_index(
        op.f("ix_certificate_spu_assignments_certificate_id"),
        table_name="certificate_spu_assignments",
    )
    op.drop_table("certificate_spu_assignments")
    op.drop_index(op.f("ix_certificates_ownership_type"), table_name="certificates")
    op.drop_index(op.f("ix_certificates_valid_to"), table_name="certificates")
    op.drop_index(op.f("ix_certificates_certificate_type"), table_name="certificates")
    op.drop_index(op.f("ix_certificates_certificate_no"), table_name="certificates")
    op.drop_index(op.f("ix_certificates_name"), table_name="certificates")
    op.drop_table("certificates")
