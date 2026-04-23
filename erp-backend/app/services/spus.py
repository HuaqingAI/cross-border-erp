from __future__ import annotations

import re

from app.core.permissions import can_view_purchase_price
from app.core.exceptions import BusinessError
from app.models.spu import SPU, SPUInvoiceInfo
from app.models.user import User, UserRole
from app.repositories.product_categories import ProductCategoryRepository
from app.repositories.skus import SKURepository
from app.repositories.spus import SPURepository
from app.schemas.spu import (
    SPUCreate,
    SPUDetailFull,
    SPUDetailPublic,
    SPUInvoiceInfoPayload,
    SPUInvoiceInfoResponse,
    SPUListItemFull,
    SPUListItemPublic,
    SPUListResponseFull,
    SPUListResponsePublic,
    SPUUpdate,
)
from sqlalchemy.ext.asyncio import AsyncSession


class SPUService:
    COUNTRY_REGION_CODE_PATTERN = re.compile(r"^(?:[A-Z]{2}|GLOBAL)$")

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = SPURepository(db)
        self.sku_repo = SKURepository(db)
        self.category_repo = ProductCategoryRepository(db)

    async def create_spu(self, data: SPUCreate, current_user: User):
        await self._ensure_unique_code(data.code)
        await self._validate_categories(
            data.level1_category_id,
            data.level2_category_id,
            data.level3_category_id,
        )
        self._validate_invoice_infos(data.invoice_infos)
        restricted_countries = self._normalize_countries(data.restricted_countries)

        spu = SPU(
            code=data.code,
            name=data.name,
            level1_category_id=data.level1_category_id,
            level2_category_id=data.level2_category_id,
            level3_category_id=data.level3_category_id,
            customer_warranty_months=data.customer_warranty_months,
            unit=data.unit,
            restricted_countries=restricted_countries,
            supplier_name=data.supplier_name,
            manufacturer_model=data.manufacturer_model,
            purchase_price=data.purchase_price,
            purchase_warranty_months=data.purchase_warranty_months,
            supplier_warranty_notes=data.supplier_warranty_notes,
        )
        await self.repo.save(spu)
        await self._replace_invoice_infos(spu.id, data.invoice_infos)
        return await self.get_spu(spu.id, current_user)

    async def get_spu(self, spu_id: int, current_user: User):
        spu = await self.repo.get_with_invoice_infos(spu_id)
        if spu is None:
            raise BusinessError("SPU不存在", code="NOT_FOUND", status_code=404)
        invoice_infos = await self.repo.list_active_invoice_infos(spu_id)
        return self._serialize_detail(spu, invoice_infos, current_user.role)

    async def list_spus(
        self,
        current_user: User,
        *,
        page: int,
        page_size: int,
        level1_category_id: int | None = None,
        level2_category_id: int | None = None,
        level3_category_id: int | None = None,
        supplier_name: str | None = None,
        keyword: str | None = None,
    ):
        items, total = await self.repo.list_spus(
            page=page,
            page_size=page_size,
            level1_category_id=level1_category_id,
            level2_category_id=level2_category_id,
            level3_category_id=level3_category_id,
            supplier_name=supplier_name,
            keyword=keyword,
        )
        serialized = [self._serialize_list_item(item, current_user.role) for item in items]
        payload = {
            "items": serialized,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
        if can_view_purchase_price(current_user.role):
            return SPUListResponseFull.model_validate(payload)
        return SPUListResponsePublic.model_validate(payload)

    async def update_spu(self, spu_id: int, data: SPUUpdate, current_user: User):
        spu = await self.repo.get_with_invoice_infos(spu_id)
        if spu is None:
            raise BusinessError("SPU不存在", code="NOT_FOUND", status_code=404)

        if data.code is not None and data.code != spu.code:
            raise BusinessError("SPU编码创建后不可修改")

        new_level1_id = data.level1_category_id or spu.level1_category_id
        new_level2_id = data.level2_category_id or spu.level2_category_id
        new_level3_id = data.level3_category_id or spu.level3_category_id
        await self._validate_categories(new_level1_id, new_level2_id, new_level3_id)

        if data.invoice_infos is not None:
            self._validate_invoice_infos(data.invoice_infos)

        restricted_countries = (
            self._normalize_countries(data.restricted_countries)
            if data.restricted_countries is not None
            else None
        )

        inherited_fields_changed = (
            new_level1_id != spu.level1_category_id
            or new_level2_id != spu.level2_category_id
            or new_level3_id != spu.level3_category_id
            or (
                data.supplier_name is not None
                and data.supplier_name != spu.supplier_name
            )
            or (
                data.customer_warranty_months is not None
                and data.customer_warranty_months != spu.customer_warranty_months
            )
            or (
                restricted_countries is not None
                and restricted_countries != spu.restricted_countries
            )
        )

        if data.supplier_name is not None and data.supplier_name != spu.supplier_name:
            if await self.repo.has_supplier_linked_business_refs(spu.id):
                raise BusinessError("该SPU下已有SKU被业务引用，供应商不可变更")
            spu.supplier_name = data.supplier_name

        if data.name is not None:
            spu.name = data.name
        spu.level1_category_id = new_level1_id
        spu.level2_category_id = new_level2_id
        spu.level3_category_id = new_level3_id
        if data.customer_warranty_months is not None:
            spu.customer_warranty_months = data.customer_warranty_months
        if data.unit is not None:
            spu.unit = data.unit
        if restricted_countries is not None:
            spu.restricted_countries = restricted_countries
        if data.manufacturer_model is not None:
            spu.manufacturer_model = data.manufacturer_model
        if "purchase_price" in data.model_fields_set:
            spu.purchase_price = data.purchase_price
        if "purchase_warranty_months" in data.model_fields_set:
            spu.purchase_warranty_months = data.purchase_warranty_months
        if "supplier_warranty_notes" in data.model_fields_set:
            spu.supplier_warranty_notes = data.supplier_warranty_notes

        await self.repo.save(spu)

        if inherited_fields_changed:
            await self.sku_repo.sync_inherited_fields_from_spu(spu)

        if data.invoice_infos is not None:
            await self._replace_invoice_infos(spu.id, data.invoice_infos)

        return await self.get_spu(spu.id, current_user)

    async def _ensure_unique_code(self, code: str) -> None:
        if await self.repo.get_by_code(code):
            raise BusinessError("SPU编码已存在")

    async def _validate_categories(
        self,
        level1_category_id: int,
        level2_category_id: int,
        level3_category_id: int,
    ) -> None:
        level1 = await self.category_repo.get_by_id(level1_category_id)
        level2 = await self.category_repo.get_by_id(level2_category_id)
        level3 = await self.category_repo.get_by_id(level3_category_id)

        if level1 is None:
            raise BusinessError("一级分类不存在")
        if level2 is None:
            raise BusinessError("二级分类不存在")
        if level3 is None:
            raise BusinessError("三级分类不存在")
        if level1.level != 1 or level2.level != 2 or level3.level != 3:
            raise BusinessError("分类层级不正确")
        if level2.parent_id != level1.id or level3.parent_id != level2.id:
            raise BusinessError("分类层级不匹配")

    def _validate_invoice_infos(self, invoice_infos: list[SPUInvoiceInfoPayload]) -> None:
        if not invoice_infos:
            raise BusinessError("开票信息至少需要一条")

    def _normalize_countries(self, values: list[str] | None) -> list[str]:
        if not values:
            return []
        result: list[str] = []
        seen: set[str] = set()
        for value in values:
            normalized = value.strip().upper()
            if not normalized or normalized in seen:
                continue
            if not self.COUNTRY_REGION_CODE_PATTERN.fullmatch(normalized):
                raise BusinessError("禁止经营国家必须为标准编码（如 CN、US、GLOBAL）")
            seen.add(normalized)
            result.append(normalized)
        return result

    async def _replace_invoice_infos(
        self,
        spu_id: int,
        invoice_infos: list[SPUInvoiceInfoPayload],
    ) -> None:
        existing = await self.repo.list_active_invoice_infos(spu_id)
        if existing:
            await self.repo.soft_delete_invoice_infos(existing)

        for index, payload in enumerate(invoice_infos):
            invoice_info = SPUInvoiceInfo(
                spu_id=spu_id,
                invoice_name=payload.invoice_name,
                invoice_unit=payload.invoice_unit,
                invoice_model=payload.invoice_model,
                company_subject=payload.company_subject,
                sort_order=payload.sort_order if payload.sort_order is not None else index,
            )
            await self.repo.save_invoice_info(invoice_info)

    def _serialize_list_item(self, spu: SPU, role: UserRole):
        payload = {
            "id": spu.id,
            "code": spu.code,
            "name": spu.name,
            "level1_category_id": spu.level1_category_id,
            "level2_category_id": spu.level2_category_id,
            "level3_category_id": spu.level3_category_id,
            "supplier_name": spu.supplier_name,
            "customer_warranty_months": spu.customer_warranty_months,
            "unit": spu.unit,
            "manufacturer_model": spu.manufacturer_model,
            "created_at": spu.created_at,
        }
        if can_view_purchase_price(role):
            payload["purchase_price"] = spu.purchase_price
            return SPUListItemFull.model_validate(payload)
        return SPUListItemPublic.model_validate(payload)

    def _serialize_detail(
        self,
        spu: SPU,
        invoice_infos: list[SPUInvoiceInfo],
        role: UserRole,
    ):
        payload = {
            "id": spu.id,
            "code": spu.code,
            "name": spu.name,
            "level1_category_id": spu.level1_category_id,
            "level2_category_id": spu.level2_category_id,
            "level3_category_id": spu.level3_category_id,
            "customer_warranty_months": spu.customer_warranty_months,
            "unit": spu.unit,
            "restricted_countries": spu.restricted_countries,
            "supplier_name": spu.supplier_name,
            "manufacturer_model": spu.manufacturer_model,
            "purchase_warranty_months": spu.purchase_warranty_months,
            "supplier_warranty_notes": spu.supplier_warranty_notes,
            "invoice_infos": [
                SPUInvoiceInfoResponse.model_validate(invoice_info)
                for invoice_info in invoice_infos
            ],
            "created_at": spu.created_at,
            "updated_at": spu.updated_at,
        }
        if can_view_purchase_price(role):
            payload["purchase_price"] = spu.purchase_price
            return SPUDetailFull.model_validate(payload)
        return SPUDetailPublic.model_validate(payload)
