from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import MetaData, Table, func, inspect, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.spu import SPU, SPUInvoiceInfo
from app.repositories.base_repository import BaseRepository


class SPURepository(BaseRepository[SPU]):
    BUSINESS_REFERENCE_TABLES = (
        "sales_order_items",
        "purchase_order_items",
        "sku_business_references",
    )

    def __init__(self, db: AsyncSession):
        super().__init__(SPU, db)

    async def get_by_code(self, code: str) -> SPU | None:
        result = await self.db.execute(
            select(self.model).where(
                self.model.code == code,
                self.model.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_with_invoice_infos(self, spu_id: int) -> SPU | None:
        result = await self.db.execute(
            select(self.model)
            .options(selectinload(self.model.invoice_infos))
            .where(
                self.model.id == spu_id,
                self.model.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_spus(
        self,
        *,
        page: int,
        page_size: int,
        level1_category_id: int | None = None,
        level2_category_id: int | None = None,
        level3_category_id: int | None = None,
        supplier_name: str | None = None,
        keyword: str | None = None,
    ) -> tuple[list[SPU], int]:
        filters = [self.model.deleted_at.is_(None)]
        if level1_category_id is not None:
            filters.append(self.model.level1_category_id == level1_category_id)
        if level2_category_id is not None:
            filters.append(self.model.level2_category_id == level2_category_id)
        if level3_category_id is not None:
            filters.append(self.model.level3_category_id == level3_category_id)
        if supplier_name:
            filters.append(self.model.supplier_name == supplier_name)
        if keyword:
            like_value = f"%{keyword}%"
            filters.append(
                or_(
                    self.model.code.like(like_value),
                    self.model.name.like(like_value),
                )
            )

        total_stmt = select(func.count()).select_from(self.model).where(*filters)
        total = (await self.db.execute(total_stmt)).scalar_one()

        stmt = (
            select(self.model)
            .where(*filters)
            .order_by(self.model.created_at.desc(), self.model.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list((await self.db.execute(stmt)).scalars().all())
        return items, total

    async def list_active_invoice_infos(self, spu_id: int) -> list[SPUInvoiceInfo]:
        result = await self.db.execute(
            select(SPUInvoiceInfo)
            .where(
                SPUInvoiceInfo.spu_id == spu_id,
                SPUInvoiceInfo.deleted_at.is_(None),
            )
            .order_by(SPUInvoiceInfo.sort_order, SPUInvoiceInfo.id)
        )
        return list(result.scalars().all())

    async def list_supplier_names(self) -> list[str]:
        result = await self.db.execute(
            select(self.model.supplier_name)
            .where(self.model.deleted_at.is_(None))
            .distinct()
            .order_by(self.model.supplier_name.asc())
        )
        return [item for item in result.scalars().all() if item]

    async def save_invoice_info(self, invoice_info: SPUInvoiceInfo) -> SPUInvoiceInfo:
        self.db.add(invoice_info)
        await self.db.flush()
        await self.db.refresh(invoice_info)
        return invoice_info

    async def soft_delete_invoice_infos(self, invoice_infos: list[SPUInvoiceInfo]) -> None:
        now = datetime.now(timezone.utc)
        for invoice_info in invoice_infos:
            invoice_info.deleted_at = now
            self.db.add(invoice_info)
        await self.db.flush()

    async def has_supplier_linked_business_refs(self, spu_id: int) -> bool:
        skus_table = await self._load_table("skus")
        if skus_table is None or "spu_id" not in skus_table.c or "id" not in skus_table.c:
            return False

        sku_stmt = select(skus_table.c.id).where(skus_table.c.spu_id == spu_id)
        if "deleted_at" in skus_table.c:
            sku_stmt = sku_stmt.where(skus_table.c.deleted_at.is_(None))

        sku_ids = list((await self.db.execute(sku_stmt)).scalars().all())
        if not sku_ids:
            return False

        for table_name in self.BUSINESS_REFERENCE_TABLES:
            table = await self._load_table(table_name)
            if table is None or "sku_id" not in table.c:
                continue

            stmt = select(func.count()).select_from(table).where(table.c.sku_id.in_(sku_ids))
            if "deleted_at" in table.c:
                stmt = stmt.where(table.c.deleted_at.is_(None))

            if (await self.db.execute(stmt)).scalar_one() > 0:
                return True

        return False

    async def _load_table(self, table_name: str) -> Table | None:
        connection = await self.db.connection()

        def _reflect(sync_connection):
            inspector = inspect(sync_connection)
            if table_name not in inspector.get_table_names():
                return None
            metadata = MetaData()
            return Table(table_name, metadata, autoload_with=sync_connection)

        return await connection.run_sync(_reflect)
