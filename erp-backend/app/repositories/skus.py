from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.sku import SKU, SKUPackageDetail
from app.models.spu import SPU
from app.repositories.base_repository import BaseRepository


class SKURepository(BaseRepository[SKU]):
    def __init__(self, db: AsyncSession):
        super().__init__(SKU, db)

    async def get_by_code(self, code: str) -> SKU | None:
        result = await self.db.execute(
            select(self.model).where(
                self.model.code == code,
                self.model.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_with_related(self, sku_id: int) -> SKU | None:
        result = await self.db.execute(
            select(self.model)
            .options(
                selectinload(self.model.spu),
                selectinload(self.model.package_details),
            )
            .where(
                self.model.id == sku_id,
                self.model.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_skus(
        self,
        *,
        page: int,
        page_size: int,
        spu_id: int | None = None,
        level1_category_id: int | None = None,
        level2_category_id: int | None = None,
        level3_category_id: int | None = None,
        supplier_name: str | None = None,
        product_status: str | None = None,
        product_type: str | None = None,
        keyword: str | None = None,
    ) -> tuple[list[SKU], int]:
        filters = [self.model.deleted_at.is_(None)]
        if spu_id is not None:
            filters.append(self.model.spu_id == spu_id)
        if level1_category_id is not None:
            filters.append(self.model.level1_category_id == level1_category_id)
        if level2_category_id is not None:
            filters.append(self.model.level2_category_id == level2_category_id)
        if level3_category_id is not None:
            filters.append(self.model.level3_category_id == level3_category_id)
        if supplier_name:
            filters.append(self.model.supplier_name == supplier_name)
        if product_status:
            filters.append(self.model.product_status == product_status)
        if product_type:
            filters.append(self.model.product_type == product_type)
        if keyword:
            like_value = f"%{keyword}%"
            filters.append(
                or_(
                    self.model.code.like(like_value),
                    self.model.name_zh.like(like_value),
                    self.model.name_en.like(like_value),
                )
            )

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

    async def list_active_package_details(self, sku_id: int) -> list[SKUPackageDetail]:
        result = await self.db.execute(
            select(SKUPackageDetail)
            .where(
                SKUPackageDetail.sku_id == sku_id,
                SKUPackageDetail.deleted_at.is_(None),
            )
            .order_by(SKUPackageDetail.sort_order, SKUPackageDetail.id)
        )
        return list(result.scalars().all())

    async def save_package_detail(
        self,
        package_detail: SKUPackageDetail,
    ) -> SKUPackageDetail:
        self.db.add(package_detail)
        await self.db.flush()
        await self.db.refresh(package_detail)
        return package_detail

    async def soft_delete_package_details(
        self,
        package_details: list[SKUPackageDetail],
    ) -> None:
        now = datetime.now(timezone.utc)
        for package_detail in package_details:
            package_detail.deleted_at = now
            self.db.add(package_detail)
        await self.db.flush()

    async def sync_inherited_fields_from_spu(self, spu: SPU) -> None:
        await self.db.execute(
            update(self.model)
            .where(
                self.model.spu_id == spu.id,
                self.model.deleted_at.is_(None),
            )
            .values(
                level1_category_id=spu.level1_category_id,
                level2_category_id=spu.level2_category_id,
                level3_category_id=spu.level3_category_id,
                supplier_name=spu.supplier_name,
                restricted_countries=list(spu.restricted_countries or []),
                customer_warranty_months=spu.customer_warranty_months,
            )
        )
