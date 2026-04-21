from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.price import Price, PriceRegion
from app.repositories.base_repository import BaseRepository


class PriceRepository(BaseRepository[Price]):
    def __init__(self, db: AsyncSession):
        super().__init__(Price, db)

    async def get_by_sku_id(self, sku_id: int) -> Price | None:
        result = await self.db.execute(
            select(self.model).where(
                self.model.sku_id == sku_id,
                self.model.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_with_related(self, price_id: int) -> Price | None:
        result = await self.db.execute(
            select(self.model)
            .execution_options(populate_existing=True)
            .options(selectinload(self.model.regions))
            .where(
                self.model.id == price_id,
                self.model.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_prices(
        self,
        *,
        page: int,
        page_size: int,
        sku_id: int | None = None,
        level1_category_id: int | None = None,
        supplier_name: str | None = None,
        keyword: str | None = None,
    ) -> tuple[list[Price], int]:
        filters = [self.model.deleted_at.is_(None)]
        if sku_id is not None:
            filters.append(self.model.sku_id == sku_id)
        if level1_category_id is not None:
            filters.append(self.model.level1_category_id == level1_category_id)
        if supplier_name:
            filters.append(self.model.supplier_name == supplier_name)
        if keyword:
            like_value = f"%{keyword}%"
            filters.append(
                or_(
                    self.model.sku_code.like(like_value),
                    self.model.sku_name_zh.like(like_value),
                    self.model.sku_name_en.like(like_value),
                    self.model.spu_code.like(like_value),
                    self.model.spu_name.like(like_value),
                )
            )

        total_stmt = select(func.count()).select_from(self.model).where(*filters)
        total = (await self.db.execute(total_stmt)).scalar_one()

        stmt = (
            select(self.model)
            .execution_options(populate_existing=True)
            .options(selectinload(self.model.regions))
            .where(*filters)
            .order_by(self.model.updated_at.desc(), self.model.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list((await self.db.execute(stmt)).scalars().all())
        return items, total

    async def list_active_regions(self, price_id: int) -> list[PriceRegion]:
        result = await self.db.execute(
            select(PriceRegion)
            .where(
                PriceRegion.price_id == price_id,
                PriceRegion.deleted_at.is_(None),
            )
            .order_by(PriceRegion.sort_order, PriceRegion.id)
        )
        return list(result.scalars().all())

    async def save_region(self, region: PriceRegion) -> PriceRegion:
        self.db.add(region)
        await self.db.flush()
        await self.db.refresh(region)
        return region

    async def soft_delete_regions(self, regions: list[PriceRegion]) -> None:
        now = datetime.now(timezone.utc)
        for region in regions:
            region.deleted_at = now
            self.db.add(region)
        await self.db.flush()

    async def find_conflicting_region(
        self,
        *,
        sku_id: int,
        country_codes: list[str],
        exclude_price_id: int | None = None,
    ) -> PriceRegion | None:
        if not country_codes:
            return None

        stmt = (
            select(PriceRegion)
            .join(Price, Price.id == PriceRegion.price_id)
            .where(
                Price.sku_id == sku_id,
                Price.deleted_at.is_(None),
                PriceRegion.deleted_at.is_(None),
                PriceRegion.country_code.in_(country_codes),
            )
        )
        if exclude_price_id is not None:
            stmt = stmt.where(Price.id != exclude_price_id)

        result = await self.db.execute(stmt.limit(1))
        return result.scalar_one_or_none()
