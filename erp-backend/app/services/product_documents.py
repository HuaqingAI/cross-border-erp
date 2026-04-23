from __future__ import annotations

import html
import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessError
from app.core.storage import get_file_url
from app.models.product_document import (
    ProductDocument,
    ProductDocumentAttachment,
    ProductDocumentCategoryAssignment,
    ProductDocumentSKUAssignment,
)
from app.models.user import User
from app.repositories.product_categories import ProductCategoryRepository
from app.repositories.product_documents import ProductDocumentRepository
from app.repositories.skus import SKURepository
from app.schemas.product_document import (
    ProductDocumentAttachmentInput,
    ProductDocumentAttachmentItem,
    ProductDocumentCreate,
    ProductDocumentDetail,
    ProductDocumentListItem,
    ProductDocumentListResponse,
    ProductDocumentOwnershipType,
    ProductDocumentRelatedCategory,
    ProductDocumentRelatedSKU,
    ProductDocumentUpdate,
)


class ProductDocumentService:
    ATTACHMENT_FOLDER = "product-documents/"

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ProductDocumentRepository(db)
        self.sku_repo = SKURepository(db)
        self.category_repo = ProductCategoryRepository(db)

    async def create_product_document(
        self,
        data: ProductDocumentCreate,
        current_user: User,
    ):
        content_html = self._normalize_content_html(data.content_html)
        attachments = self._normalize_attachments(data.attachments)
        self._validate_content_or_attachments(content_html, attachments)

        ownership_type = data.ownership_type.value
        sku_ids = self._normalize_ids(data.sku_ids)
        category_ids = self._normalize_ids(data.category_ids)
        applicable_countries = self._normalize_countries(data.applicable_countries)
        await self._validate_ownership_targets(ownership_type, sku_ids, category_ids)

        product_document = ProductDocument(
            name=data.name,
            document_type=data.document_type,
            content_html=content_html,
            ownership_type=ownership_type,
            applicable_countries=applicable_countries,
            remarks=data.remarks,
        )
        await self.repo.save(product_document)
        await self._replace_assignments(
            product_document.id,
            ownership_type,
            sku_ids,
            category_ids,
        )
        await self._replace_attachments(product_document.id, attachments)
        return await self.get_product_document(product_document.id, current_user)

    async def get_product_document(
        self,
        product_document_id: int,
        current_user: User,
    ):
        del current_user
        product_document = await self.repo.get_with_related(product_document_id)
        if product_document is None:
            raise BusinessError("产品资料不存在", code="NOT_FOUND", status_code=404)
        return self._serialize_detail(product_document)

    async def list_product_documents(
        self,
        current_user: User,
        *,
        page: int,
        page_size: int,
        document_type: str | None = None,
        ownership_type: str | None = None,
        keyword: str | None = None,
        aggregate_sku_id: int | None = None,
        aggregate_category_ids: list[int] | None = None,
    ):
        del current_user
        items, total = await self.repo.list_product_documents(
            page=page,
            page_size=page_size,
            document_type=document_type,
            ownership_type=ownership_type,
            keyword=keyword,
            aggregate_sku_id=aggregate_sku_id,
            aggregate_category_ids=self._normalize_ids(aggregate_category_ids),
        )
        return ProductDocumentListResponse.model_validate(
            {
                "items": [self._serialize_list_item(item) for item in items],
                "total": total,
                "page": page,
                "page_size": page_size,
            }
        )

    async def update_product_document(
        self,
        product_document_id: int,
        data: ProductDocumentUpdate,
        current_user: User,
    ):
        product_document = await self.repo.get_with_related(product_document_id)
        if product_document is None:
            raise BusinessError("产品资料不存在", code="NOT_FOUND", status_code=404)

        target_ownership_type = (
            data.ownership_type.value
            if data.ownership_type is not None
            else product_document.ownership_type
        )
        current_sku_ids = [item.sku_id for item in product_document.sku_assignments]
        current_category_ids = [
            item.category_id for item in product_document.category_assignments
        ]
        requested_sku_ids = (
            self._normalize_ids(data.sku_ids)
            if "sku_ids" in data.model_fields_set
            else current_sku_ids
        )
        requested_category_ids = (
            self._normalize_ids(data.category_ids)
            if "category_ids" in data.model_fields_set
            else current_category_ids
        )
        if target_ownership_type == ProductDocumentOwnershipType.GENERAL.value:
            target_sku_ids = []
            target_category_ids = []
        elif target_ownership_type == ProductDocumentOwnershipType.SKU.value:
            target_sku_ids = requested_sku_ids
            target_category_ids = []
        elif target_ownership_type == ProductDocumentOwnershipType.CATEGORY.value:
            target_sku_ids = []
            target_category_ids = requested_category_ids
        else:
            target_sku_ids = requested_sku_ids
            target_category_ids = requested_category_ids
        await self._validate_ownership_targets(
            target_ownership_type,
            target_sku_ids,
            target_category_ids,
        )

        current_content_html = product_document.content_html
        target_content_html = (
            self._normalize_content_html(data.content_html)
            if "content_html" in data.model_fields_set
            else current_content_html
        )
        current_attachments = [
            ProductDocumentAttachmentInput(
                object_key=item.object_key,
                file_url=item.file_url,
                file_name=item.file_name,
                sort_order=item.sort_order,
            )
            for item in product_document.attachments
        ]
        target_attachments = (
            self._normalize_attachments(data.attachments)
            if "attachments" in data.model_fields_set
            else current_attachments
        )
        self._validate_content_or_attachments(target_content_html, target_attachments)

        if data.name is not None:
            product_document.name = data.name
        if "document_type" in data.model_fields_set:
            product_document.document_type = data.document_type
        if "content_html" in data.model_fields_set:
            product_document.content_html = target_content_html
        product_document.ownership_type = target_ownership_type
        if "applicable_countries" in data.model_fields_set:
            product_document.applicable_countries = self._normalize_countries(
                data.applicable_countries
            )
        if "remarks" in data.model_fields_set:
            product_document.remarks = data.remarks

        await self.repo.save(product_document)
        await self._replace_assignments(
            product_document.id,
            target_ownership_type,
            target_sku_ids,
            target_category_ids,
        )
        if "attachments" in data.model_fields_set:
            await self._replace_attachments(product_document.id, target_attachments)
        return await self.get_product_document(product_document.id, current_user)

    async def delete_product_document(
        self,
        product_document_id: int,
        current_user: User,
    ) -> None:
        del current_user
        product_document = await self.repo.get_with_related(product_document_id)
        if product_document is None:
            raise BusinessError("产品资料不存在", code="NOT_FOUND", status_code=404)

        if product_document.sku_assignments:
            await self.repo.soft_delete_sku_assignments(product_document.sku_assignments)
        if product_document.category_assignments:
            await self.repo.soft_delete_category_assignments(
                product_document.category_assignments
            )
        if product_document.attachments:
            await self.repo.soft_delete_attachments(product_document.attachments)
        await self.repo.soft_delete(product_document)

    async def _validate_ownership_targets(
        self,
        ownership_type: str,
        sku_ids: list[int],
        category_ids: list[int],
    ) -> None:
        if ownership_type == ProductDocumentOwnershipType.GENERAL.value:
            if sku_ids or category_ids:
                raise BusinessError("通用归属不能指定SKU或分类")
            return
        if ownership_type == ProductDocumentOwnershipType.SKU.value:
            if not sku_ids:
                raise BusinessError("归属类型为'指定SKU'时，SKU 选择必填")
            await self._ensure_skus_exist(sku_ids)
            return
        if ownership_type == ProductDocumentOwnershipType.CATEGORY.value:
            if not category_ids:
                raise BusinessError("归属类型为'按分类'时，分类选择必填")
            await self._ensure_categories_exist(category_ids)
            return
        raise BusinessError("产品资料归属类型不支持")

    async def _ensure_skus_exist(self, sku_ids: list[int]) -> None:
        for sku_id in sku_ids:
            sku = await self.sku_repo.get_by_id(sku_id)
            if sku is None:
                raise BusinessError("SKU不存在", code="NOT_FOUND", status_code=404)

    async def _ensure_categories_exist(self, category_ids: list[int]) -> None:
        for category_id in category_ids:
            category = await self.category_repo.get_by_id(category_id)
            if category is None:
                raise BusinessError("分类不存在", code="NOT_FOUND", status_code=404)

    async def _replace_assignments(
        self,
        product_document_id: int,
        ownership_type: str,
        sku_ids: list[int],
        category_ids: list[int],
    ) -> None:
        existing_sku_assignments = await self.repo.list_active_sku_assignments(
            product_document_id
        )
        existing_category_assignments = await self.repo.list_active_category_assignments(
            product_document_id
        )
        if existing_sku_assignments:
            await self.repo.soft_delete_sku_assignments(existing_sku_assignments)
        if existing_category_assignments:
            await self.repo.soft_delete_category_assignments(
                existing_category_assignments
            )

        if ownership_type == ProductDocumentOwnershipType.SKU.value:
            for sku_id in sku_ids:
                await self.repo.save_sku_assignment(
                    ProductDocumentSKUAssignment(
                        product_document_id=product_document_id,
                        sku_id=sku_id,
                    )
                )
        elif ownership_type == ProductDocumentOwnershipType.CATEGORY.value:
            for category_id in category_ids:
                await self.repo.save_category_assignment(
                    ProductDocumentCategoryAssignment(
                        product_document_id=product_document_id,
                        category_id=category_id,
                    )
                )

    async def _replace_attachments(
        self,
        product_document_id: int,
        attachments: list[ProductDocumentAttachmentInput],
    ) -> None:
        existing_attachments = await self.repo.list_active_attachments(product_document_id)
        if existing_attachments:
            await self.repo.soft_delete_attachments(existing_attachments)

        for attachment in attachments:
            await self.repo.save_attachment(
                ProductDocumentAttachment(
                    product_document_id=product_document_id,
                    object_key=attachment.object_key,
                    file_url=attachment.file_url,
                    file_name=attachment.file_name,
                    sort_order=attachment.sort_order or 0,
                )
            )

    def _normalize_ids(self, values: list[int] | None) -> list[int]:
        if not values:
            return []
        result: list[int] = []
        seen: set[int] = set()
        for value in values:
            if value not in seen:
                seen.add(value)
                result.append(value)
        return result

    def _normalize_countries(self, values: list[str] | None) -> list[str]:
        if not values:
            return []
        result: list[str] = []
        seen: set[str] = set()
        for value in values:
            normalized = value.strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            result.append(normalized)
        return result

    def _normalize_content_html(self, content_html: str | None) -> str | None:
        if content_html is None:
            return None
        normalized = content_html.strip()
        if self._is_blank_rich_text(normalized):
            return None
        return normalized

    def _is_blank_rich_text(self, content_html: str) -> bool:
        text = re.sub(r"<[^>]+>", "", content_html)
        text = html.unescape(text).replace("\xa0", " ").strip()
        return text == ""

    def _normalize_attachments(
        self,
        attachments: list[ProductDocumentAttachmentInput] | None,
    ) -> list[ProductDocumentAttachmentInput]:
        if not attachments:
            return []
        result: list[ProductDocumentAttachmentInput] = []
        seen: set[str] = set()
        for index, attachment in enumerate(attachments):
            self._validate_attachment(attachment)
            if attachment.object_key in seen:
                continue
            seen.add(attachment.object_key)
            result.append(
                ProductDocumentAttachmentInput(
                    object_key=attachment.object_key,
                    file_url=attachment.file_url,
                    file_name=attachment.file_name,
                    sort_order=(
                        attachment.sort_order
                        if attachment.sort_order is not None
                        else index
                    ),
                )
            )
        return result

    def _validate_attachment(self, attachment: ProductDocumentAttachmentInput) -> None:
        if not attachment.object_key.startswith(self.ATTACHMENT_FOLDER):
            raise BusinessError("资料附件对象键非法")
        expected_file_url = get_file_url(attachment.object_key)
        if attachment.file_url != expected_file_url:
            raise BusinessError("资料附件URL与对象键不匹配")

    def _validate_content_or_attachments(
        self,
        content_html: str | None,
        attachments: list[ProductDocumentAttachmentInput],
    ) -> None:
        if content_html is None and not attachments:
            raise BusinessError("资料内容和资料文件至少填写一项")

    def _build_ownership_summary(self, product_document: ProductDocument) -> str:
        if product_document.ownership_type == ProductDocumentOwnershipType.GENERAL.value:
            return "通用（全部SKU）"
        if product_document.ownership_type == ProductDocumentOwnershipType.SKU.value:
            labels = [
                f"{item.sku.code}/{item.sku.name_zh}"
                for item in product_document.sku_assignments
                if item.sku is not None
            ]
            if not labels:
                return "指定SKU"
            summary = "、".join(labels[:3])
            if len(labels) > 3:
                summary += " 等"
            return f"指定SKU：{summary}"
        if product_document.ownership_type == ProductDocumentOwnershipType.CATEGORY.value:
            labels = [
                item.category.name
                for item in product_document.category_assignments
                if item.category is not None
            ]
            if not labels:
                return "按分类"
            summary = "、".join(labels[:3])
            if len(labels) > 3:
                summary += " 等"
            return f"按分类：{summary}"
        return product_document.ownership_type

    def _serialize_attachment(
        self,
        attachment: ProductDocumentAttachment,
    ) -> ProductDocumentAttachmentItem:
        return ProductDocumentAttachmentItem.model_validate(
            {
                "id": attachment.id,
                "object_key": attachment.object_key,
                "file_url": attachment.file_url,
                "file_name": attachment.file_name,
                "sort_order": attachment.sort_order,
            }
        )

    def _serialize_list_item(
        self,
        product_document: ProductDocument,
    ) -> ProductDocumentListItem:
        return ProductDocumentListItem.model_validate(
            {
                "id": product_document.id,
                "name": product_document.name,
                "document_type": product_document.document_type,
                "ownership_type": product_document.ownership_type,
                "ownership_summary": self._build_ownership_summary(product_document),
                "sku_ids": [
                    item.sku_id for item in product_document.sku_assignments
                ],
                "category_ids": [
                    item.category_id for item in product_document.category_assignments
                ],
                "applicable_countries": list(
                    product_document.applicable_countries or []
                ),
                "attachments": [
                    self._serialize_attachment(item)
                    for item in product_document.attachments
                ],
                "created_at": product_document.created_at,
            }
        )

    def _serialize_detail(
        self,
        product_document: ProductDocument,
    ) -> ProductDocumentDetail:
        return ProductDocumentDetail.model_validate(
            {
                "id": product_document.id,
                "name": product_document.name,
                "document_type": product_document.document_type,
                "content_html": product_document.content_html,
                "ownership_type": product_document.ownership_type,
                "ownership_summary": self._build_ownership_summary(product_document),
                "sku_ids": [item.sku_id for item in product_document.sku_assignments],
                "category_ids": [
                    item.category_id for item in product_document.category_assignments
                ],
                "applicable_countries": list(
                    product_document.applicable_countries or []
                ),
                "skus": [
                    ProductDocumentRelatedSKU.model_validate(
                        {
                            "id": item.id,
                            "sku_id": item.sku_id,
                            "sku_code": item.sku.code,
                            "sku_name_zh": item.sku.name_zh,
                        }
                    )
                    for item in product_document.sku_assignments
                    if item.sku is not None
                ],
                "categories": [
                    ProductDocumentRelatedCategory.model_validate(
                        {
                            "id": item.id,
                            "category_id": item.category_id,
                            "category_code": item.category.code,
                            "category_name": item.category.name,
                            "level": item.category.level,
                        }
                    )
                    for item in product_document.category_assignments
                    if item.category is not None
                ],
                "attachments": [
                    self._serialize_attachment(item)
                    for item in product_document.attachments
                ],
                "remarks": product_document.remarks,
                "created_at": product_document.created_at,
                "updated_at": product_document.updated_at,
            }
        )
