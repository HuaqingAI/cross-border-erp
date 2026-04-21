from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.faq import FAQ
from app.repositories.base_repository import BaseRepository


class FAQRepository(BaseRepository[FAQ]):
    def __init__(self, db: AsyncSession):
        super().__init__(FAQ, db)

    async def get_with_related(self, faq_id: int) -> FAQ | None:
        result = await self.db.execute(
            select(self.model)
            .options(selectinload(self.model.spu))
            .where(
                self.model.id == faq_id,
                self.model.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_faqs(
        self,
        *,
        page: int,
        page_size: int,
        spu_id: int | None = None,
        question_type: str | None = None,
        keyword: str | None = None,
    ) -> tuple[list[FAQ], int]:
        filters = [self.model.deleted_at.is_(None)]
        if spu_id is not None:
            filters.append(self.model.spu_id == spu_id)
        if question_type:
            filters.append(self.model.question_type == question_type)
        if keyword:
            like_value = f"%{keyword}%"
            filters.append(self.model.question.like(like_value))

        total_stmt = select(func.count()).select_from(self.model).where(*filters)
        total = (await self.db.execute(total_stmt)).scalar_one()

        stmt = (
            select(self.model)
            .options(selectinload(self.model.spu))
            .where(*filters)
            .order_by(self.model.created_at.desc(), self.model.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list((await self.db.execute(stmt)).scalars().all())
        return items, total
