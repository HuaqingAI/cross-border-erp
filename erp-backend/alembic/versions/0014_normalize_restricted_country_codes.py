"""normalize_restricted_country_codes

Revision ID: 0014
Revises: 0013
Create Date: 2026-04-23
"""

from __future__ import annotations

import json
import re
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COUNTRY_REGION_CODE_PATTERN = re.compile(r"^(?:[A-Z]{2}|GLOBAL)$")
COUNTRY_REGION_ALIASES = {
    "全球": "GLOBAL",
    "global": "GLOBAL",
    "中国": "CN",
    "中国大陆": "CN",
    "china": "CN",
    "美国": "US",
    "usa": "US",
    "united states": "US",
    "德国": "DE",
    "germany": "DE",
    "法国": "FR",
    "france": "FR",
    "日本": "JP",
    "japan": "JP",
    "伊朗": "IR",
    "iran": "IR",
    "朝鲜": "KP",
    "north korea": "KP",
}


def _normalize_countries(values: object) -> list[str]:
    if values is None:
        return []

    if isinstance(values, str):
        try:
            decoded = json.loads(values)
        except json.JSONDecodeError:
            decoded = [values]
        values = decoded

    if not isinstance(values, list):
        return []

    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        if not isinstance(value, str):
            continue
        stripped = value.strip()
        normalized = stripped.upper()
        alias = COUNTRY_REGION_ALIASES.get(stripped.lower()) or COUNTRY_REGION_ALIASES.get(stripped)
        if alias is not None:
            normalized = alias
        if not normalized or normalized in seen:
            continue
        if not COUNTRY_REGION_CODE_PATTERN.fullmatch(normalized):
            continue
        seen.add(normalized)
        result.append(normalized)
    return result


def _normalize_table(table_name: str) -> None:
    bind = op.get_bind()
    table = sa.table(
        table_name,
        sa.column("id", sa.Integer),
        sa.column("restricted_countries", sa.JSON),
    )

    rows = bind.execute(
        sa.select(
            table.c.id,
            table.c.restricted_countries,
        )
    ).all()

    for row in rows:
        normalized = _normalize_countries(row.restricted_countries)
        bind.execute(
            table.update()
            .where(table.c.id == row.id)
            .values(restricted_countries=normalized)
        )


def upgrade() -> None:
    _normalize_table("spus")
    _normalize_table("skus")


def downgrade() -> None:
    # 历史自由文本禁止经营国家已被清洗或丢弃，无法无损回滚。
    pass
