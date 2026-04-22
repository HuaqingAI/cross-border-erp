"""add_price_approval_workflow

Revision ID: 0011
Revises: 0010
Create Date: 2026-04-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "prices",
        sa.Column("approval_status", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "prices",
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "prices",
        sa.Column("submitted_by", sa.Integer(), nullable=True),
    )
    op.add_column(
        "prices",
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "prices",
        sa.Column("approved_by", sa.Integer(), nullable=True),
    )
    op.add_column(
        "prices",
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "prices",
        sa.Column("rejected_by", sa.Integer(), nullable=True),
    )
    op.add_column(
        "prices",
        sa.Column("rejection_reason", sa.String(length=500), nullable=True),
    )
    op.create_foreign_key(
        "fk_prices_submitted_by_users",
        "prices",
        "users",
        ["submitted_by"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_prices_approved_by_users",
        "prices",
        "users",
        ["approved_by"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_prices_rejected_by_users",
        "prices",
        "users",
        ["rejected_by"],
        ["id"],
    )
    op.create_index(op.f("ix_prices_approval_status"), "prices", ["approval_status"], unique=False)
    op.create_index(op.f("ix_prices_submitted_by"), "prices", ["submitted_by"], unique=False)
    op.create_index(op.f("ix_prices_approved_by"), "prices", ["approved_by"], unique=False)
    op.create_index(op.f("ix_prices_rejected_by"), "prices", ["rejected_by"], unique=False)

    op.execute("UPDATE prices SET approval_status = '已生效' WHERE approval_status IS NULL")
    op.alter_column("prices", "approval_status", existing_type=sa.String(length=20), nullable=False)

    op.add_column(
        "price_regions",
        sa.Column(
            "version_stage",
            sa.String(length=20),
            nullable=False,
            server_default="approved",
        ),
    )
    op.create_index(op.f("ix_price_regions_version_stage"), "price_regions", ["version_stage"], unique=False)
    op.drop_index(op.f("ix_price_regions_price_id_active_country_code"), table_name="price_regions")
    op.create_index(
        op.f("ix_price_regions_price_id_version_stage_active_country_code"),
        "price_regions",
        ["price_id", "version_stage", "active_country_code"],
        unique=True,
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE price_regions
        SET deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP)
        WHERE deleted_at IS NULL
          AND version_stage = 'draft'
          AND EXISTS (
              SELECT 1
              FROM price_regions AS approved
              WHERE approved.price_id = price_regions.price_id
                AND approved.country_code = price_regions.country_code
                AND approved.version_stage = 'approved'
                AND approved.deleted_at IS NULL
          )
        """
    )
    op.drop_index(
        op.f("ix_price_regions_price_id_version_stage_active_country_code"),
        table_name="price_regions",
    )
    op.create_index(
        op.f("ix_price_regions_price_id_active_country_code"),
        "price_regions",
        ["price_id", "active_country_code"],
        unique=True,
    )
    op.drop_index(op.f("ix_price_regions_version_stage"), table_name="price_regions")
    op.drop_column("price_regions", "version_stage")

    op.drop_index(op.f("ix_prices_rejected_by"), table_name="prices")
    op.drop_index(op.f("ix_prices_approved_by"), table_name="prices")
    op.drop_index(op.f("ix_prices_submitted_by"), table_name="prices")
    op.drop_index(op.f("ix_prices_approval_status"), table_name="prices")
    op.drop_constraint("fk_prices_rejected_by_users", "prices", type_="foreignkey")
    op.drop_constraint("fk_prices_approved_by_users", "prices", type_="foreignkey")
    op.drop_constraint("fk_prices_submitted_by_users", "prices", type_="foreignkey")
    op.drop_column("prices", "rejection_reason")
    op.drop_column("prices", "rejected_by")
    op.drop_column("prices", "rejected_at")
    op.drop_column("prices", "approved_by")
    op.drop_column("prices", "approved_at")
    op.drop_column("prices", "submitted_by")
    op.drop_column("prices", "submitted_at")
    op.drop_column("prices", "approval_status")
