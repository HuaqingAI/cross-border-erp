"""normalize_document_country_codes

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-23
"""

from __future__ import annotations

import json
import re
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COUNTRY_REGION_CODE_PATTERN = re.compile(r"^(?:[A-Z]{2}|GLOBAL)$")


def _normalize_countries(values: object) -> list[str]:
    if values is None:
        return []

    if isinstance(values, str):
        try:
            decoded = json.loads(values)
        except json.JSONDecodeError:
            return []
        values = decoded

    if not isinstance(values, list):
        return []

    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        if not isinstance(value, str):
            continue
        normalized = value.strip().upper()
        if not normalized or normalized in seen:
            continue
        if not COUNTRY_REGION_CODE_PATTERN.fullmatch(normalized):
            continue
        seen.add(normalized)
        result.append(normalized)
    return result


def upgrade() -> None:
    bind = op.get_bind()
    product_documents = sa.table(
        "product_documents",
        sa.column("id", sa.Integer),
        sa.column("applicable_countries", sa.JSON),
    )

    rows = bind.execute(
        sa.select(
            product_documents.c.id,
            product_documents.c.applicable_countries,
        )
    ).all()

    for row in rows:
        normalized = _normalize_countries(row.applicable_countries)
        bind.execute(
            product_documents.update()
            .where(product_documents.c.id == row.id)
            .values(applicable_countries=normalized)
        )


def downgrade() -> None:
    # 历史自由文本国家/地区值已被清洗丢弃，无法无损回滚。
    pass
