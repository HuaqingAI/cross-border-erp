from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product_document import (
    ProductDocument,
    ProductDocumentAttachment,
    ProductDocumentCategoryAssignment,
    ProductDocumentSKUAssignment,
)
from app.repositories.base_repository import BaseRepository


class ProductDocumentRepository(BaseRepository[ProductDocument]):
    def __init__(self, db: AsyncSession):
        super().__init__(ProductDocument, db)

    async def get_with_related(self, product_document_id: int) -> ProductDocument | None:
        result = await self.db.execute(
            select(self.model)
            .execution_options(populate_existing=True)
            .options(
                selectinload(self.model.sku_assignments).selectinload(
                    ProductDocumentSKUAssignment.sku
                ),
                selectinload(self.model.category_assignments).selectinload(
                    ProductDocumentCategoryAssignment.category
                ),
                selectinload(self.model.attachments),
            )
            .where(
                self.model.id == product_document_id,
                self.model.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_product_documents(
        self,
        *,
        page: int,
        page_size: int,
        document_type: str | None = None,
        ownership_type: str | None = None,
        keyword: str | None = None,
    ) -> tuple[list[ProductDocument], int]:
        filters = [self.model.deleted_at.is_(None)]
        if document_type:
            filters.append(self.model.document_type == document_type)
        if ownership_type:
            filters.append(self.model.ownership_type == ownership_type)
        if keyword:
            like_value = f"%{keyword}%"
            filters.append(self.model.name.like(like_value))

        total_stmt = select(func.count()).select_from(self.model).where(*filters)
        total = (await self.db.execute(total_stmt)).scalar_one()

        stmt = (
            select(self.model)
            .options(
                selectinload(self.model.sku_assignments).selectinload(
                    ProductDocumentSKUAssignment.sku
                ),
                selectinload(self.model.category_assignments).selectinload(
                    ProductDocumentCategoryAssignment.category
                ),
                selectinload(self.model.attachments),
            )
            .where(*filters)
            .order_by(self.model.created_at.desc(), self.model.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list((await self.db.execute(stmt)).scalars().all())
        return items, total

    async def list_active_sku_assignments(
        self,
        product_document_id: int,
    ) -> list[ProductDocumentSKUAssignment]:
        result = await self.db.execute(
            select(ProductDocumentSKUAssignment)
            .options(selectinload(ProductDocumentSKUAssignment.sku))
            .where(
                ProductDocumentSKUAssignment.product_document_id == product_document_id,
                ProductDocumentSKUAssignment.deleted_at.is_(None),
            )
            .order_by(ProductDocumentSKUAssignment.id)
        )
        return list(result.scalars().all())

    async def list_active_category_assignments(
        self,
        product_document_id: int,
    ) -> list[ProductDocumentCategoryAssignment]:
        result = await self.db.execute(
            select(ProductDocumentCategoryAssignment)
            .options(selectinload(ProductDocumentCategoryAssignment.category))
            .where(
                ProductDocumentCategoryAssignment.product_document_id
                == product_document_id,
                ProductDocumentCategoryAssignment.deleted_at.is_(None),
            )
            .order_by(ProductDocumentCategoryAssignment.id)
        )
        return list(result.scalars().all())

    async def list_active_attachments(
        self,
        product_document_id: int,
    ) -> list[ProductDocumentAttachment]:
        result = await self.db.execute(
            select(ProductDocumentAttachment)
            .where(
                ProductDocumentAttachment.product_document_id == product_document_id,
                ProductDocumentAttachment.deleted_at.is_(None),
            )
            .order_by(
                ProductDocumentAttachment.sort_order,
                ProductDocumentAttachment.id,
            )
        )
        return list(result.scalars().all())

    async def save_sku_assignment(
        self,
        assignment: ProductDocumentSKUAssignment,
    ) -> ProductDocumentSKUAssignment:
        self.db.add(assignment)
        await self.db.flush()
        await self.db.refresh(assignment)
        return assignment

    async def save_category_assignment(
        self,
        assignment: ProductDocumentCategoryAssignment,
    ) -> ProductDocumentCategoryAssignment:
        self.db.add(assignment)
        await self.db.flush()
        await self.db.refresh(assignment)
        return assignment

    async def save_attachment(
        self,
        attachment: ProductDocumentAttachment,
    ) -> ProductDocumentAttachment:
        self.db.add(attachment)
        await self.db.flush()
        await self.db.refresh(attachment)
        return attachment

    async def soft_delete_sku_assignments(
        self,
        assignments: list[ProductDocumentSKUAssignment],
    ) -> None:
        now = datetime.now(timezone.utc)
        for assignment in assignments:
            assignment.deleted_at = now
            self.db.add(assignment)
        await self.db.flush()

    async def soft_delete_category_assignments(
        self,
        assignments: list[ProductDocumentCategoryAssignment],
    ) -> None:
        now = datetime.now(timezone.utc)
        for assignment in assignments:
            assignment.deleted_at = now
            self.db.add(assignment)
        await self.db.flush()

    async def soft_delete_attachments(
        self,
        attachments: list[ProductDocumentAttachment],
    ) -> None:
        now = datetime.now(timezone.utc)
        for attachment in attachments:
            attachment.deleted_at = now
            self.db.add(attachment)
        await self.db.flush()
