from __future__ import annotations

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_enum import SystemEnum
from app.repositories.base_repository import BaseRepository


class EnumRepository(BaseRepository[SystemEnum]):
    def __init__(self, db: AsyncSession):
        super().__init__(SystemEnum, db)

    async def list_by_group(
        self,
        enum_group: str,
        *,
        include_disabled: bool,
    ) -> list[SystemEnum]:
        filters = [
            self.model.enum_group == enum_group,
            self.model.deleted_at.is_(None),
        ]
        if not include_disabled:
            filters.append(self.model.is_enabled.is_(True))

        stmt = (
            select(self.model)
            .where(*filters)
            .order_by(self.model.sort_order.asc(), self.model.id.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_group_and_key(
        self,
        enum_group: str,
        enum_key: str,
        *,
        exclude_id: int | None = None,
    ) -> SystemEnum | None:
        stmt = select(self.model).where(
            self.model.enum_group == enum_group,
            self.model.enum_key == enum_key,
            self.model.deleted_at.is_(None),
        )
        if exclude_id is not None:
            stmt = stmt.where(self.model.id != exclude_id)
        result = await self.db.execute(stmt.limit(1))
        return result.scalar_one_or_none()

    async def list_enabled_by_group(self, enum_group: str) -> list[SystemEnum]:
        stmt = (
            select(self.model)
            .where(
                self.model.enum_group == enum_group,
                self.model.is_enabled.is_(True),
                self.model.deleted_at.is_(None),
            )
            .order_by(self.model.sort_order.asc(), self.model.id.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count_by_group(self) -> dict[str, dict[str, int]]:
        stmt = (
            select(
                self.model.enum_group,
                func.count(self.model.id),
                func.coalesce(
                    func.sum(case((self.model.is_enabled.is_(True), 1), else_=0)),
                    0,
                ),
            )
            .where(self.model.deleted_at.is_(None))
            .group_by(self.model.enum_group)
        )
        result = await self.db.execute(stmt)
        return {
            group: {"total_count": total_count, "enabled_count": enabled_count}
            for group, total_count, enabled_count in result.all()
        }
