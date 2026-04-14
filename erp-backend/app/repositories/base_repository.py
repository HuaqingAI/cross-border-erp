from datetime import datetime, timezone
from typing import Generic, Type, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import BaseModel

T = TypeVar("T", bound=BaseModel)


class BaseRepository(Generic[T]):
    def __init__(self, model: Type[T], db: AsyncSession) -> None:
        self.model = model
        self.db = db

    async def get_by_id(self, id: int) -> T | None:
        result = await self.db.execute(
            select(self.model).where(
                self.model.id == id,
                self.model.deleted_at.is_(None),  # 软删除过滤
            )
        )
        return result.scalar_one_or_none()

    async def get_all(self) -> list[T]:
        result = await self.db.execute(
            select(self.model).where(self.model.deleted_at.is_(None))
        )
        return list(result.scalars().all())

    async def save(self, entity: T) -> T:
        self.db.add(entity)
        await self.db.flush()
        await self.db.refresh(entity)
        return entity

    async def soft_delete(self, entity: T) -> None:
        entity.deleted_at = datetime.now(timezone.utc)
        self.db.add(entity)
