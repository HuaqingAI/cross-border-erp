from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.import_task import ImportTask
from app.repositories.base_repository import BaseRepository


class ImportTaskRepository(BaseRepository[ImportTask]):
    def __init__(self, db: AsyncSession):
        super().__init__(ImportTask, db)

    async def get_active_by_id(self, task_id: int) -> ImportTask | None:
        result = await self.db.execute(
            select(self.model).where(
                self.model.id == task_id,
                self.model.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def soft_delete_expired(self, now: datetime | None = None) -> None:
        current = now or datetime.now(timezone.utc)
        result = await self.db.execute(
            select(self.model).where(
                self.model.deleted_at.is_(None),
                self.model.expires_at.is_not(None),
                self.model.expires_at < current,
            )
        )
        tasks = list(result.scalars().all())
        for task in tasks:
            task.deleted_at = current
            self.db.add(task)
        if tasks:
            await self.db.flush()
