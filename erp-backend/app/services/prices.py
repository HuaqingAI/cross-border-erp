from __future__ import annotations

from datetime import datetime, timezone

from app.core.audit import audit_service
from app.core.exceptions import BusinessError, translate_integrity_error
from app.core.permissions import can_view_full_price, can_view_purchase_price
from app.models.price import Price, PriceRegion
from app.models.product_category import ProductCategory
from app.models.sku import SKU
from app.models.user import User, UserRole
from app.repositories.enums import EnumRepository
from app.repositories.prices import PriceRepository
from app.repositories.product_categories import ProductCategoryRepository
from app.repositories.skus import SKURepository
from app.schemas.price import (
    PriceCreate,
    PriceDetail,
    PriceRejectRequest,
    PriceApprovalStatus,
    PriceListItem,
    PriceListResponse,
    PriceRegionPayload,
    PriceRegionResponse,
    PriceUpdate,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


class PriceService:
    REGION_STAGE_DRAFT = "draft"
    REGION_STAGE_APPROVED = "approved"
    COUNTRY_REGION_GROUP = "country_region"
    DUPLICATE_PRICE_MESSAGE = "该SKU已存在价格记录"
    DUPLICATE_REGION_MESSAGE = "同一 SKU 同一国家/地区不可重复设置价格"
    SUBMIT_FORBIDDEN_MESSAGE = "当前状态不可提交审批"
    APPROVE_FORBIDDEN_MESSAGE = "当前状态不可审批"
    REJECT_FORBIDDEN_MESSAGE = "当前状态不可驳回"
    PENDING_EDIT_FORBIDDEN_MESSAGE = "待审批价格不可编辑"
    SKU_CHANGE_FORBIDDEN_MESSAGE = "价格已进入审批流程后不可更换SKU"
    NO_DRAFT_MESSAGE = "没有待提交的价格变更"

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PriceRepository(db)
        self.enum_repo = EnumRepository(db)
        self.sku_repo = SKURepository(db)
        self.category_repo = ProductCategoryRepository(db)

    async def create_price(self, data: PriceCreate, current_user: User):
        sku = await self._get_sku_or_raise(data.sku_id)
        categories = await self._get_category_snapshot(sku)
        await self._ensure_unique_price_for_sku(sku.id)
        await self._ensure_unique_regions(sku.id, data.regions)

        price = Price(
            sku_id=sku.id,
            sku_code=sku.code,
            sku_name_zh=sku.name_zh,
            sku_name_en=sku.name_en,
            spu_id=sku.spu_id,
            spu_code=sku.spu.code,
            spu_name=sku.spu.name,
            level1_category_id=categories[0].id,
            level1_category_code=categories[0].code,
            level1_category_name=categories[0].name,
            level2_category_id=categories[1].id,
            level2_category_code=categories[1].code,
            level2_category_name=categories[1].name,
            level3_category_id=categories[2].id,
            level3_category_code=categories[2].code,
            level3_category_name=categories[2].name,
            purchase_price=sku.spu.purchase_price,
            supplier_name=sku.supplier_name,
            product_model=sku.product_model,
            product_status=sku.product_status,
            approval_status=PriceApprovalStatus.DRAFT.value,
        )
        try:
            await self.repo.save(price)
            await self._replace_regions(
                price.id,
                data.regions,
                version_stage=self.REGION_STAGE_DRAFT,
            )
        except IntegrityError as exc:
            await self.db.rollback()
            self._raise_translated_integrity_error(exc)
        return await self.get_price(price.id, current_user)

    async def get_price(self, price_id: int, current_user: User):
        price = await self.repo.get_with_related(price_id)
        if price is None:
            raise BusinessError("价格不存在", code="NOT_FOUND", status_code=404)
        return self._serialize_detail(price, current_user.role)

    async def get_effective_price_by_sku(self, sku_id: int, current_user: User):
        price = await self.repo.get_by_sku_id_with_related(sku_id)
        if price is None:
            raise BusinessError("价格不存在", code="NOT_FOUND", status_code=404)
        if not self._get_approved_regions(price):
            raise BusinessError("暂无已生效价格", code="NOT_FOUND", status_code=404)
        return self._serialize_detail(price, current_user.role, effective_only=True)

    async def list_prices(
        self,
        current_user: User,
        *,
        page: int,
        page_size: int,
        sku_id: int | None = None,
        level1_category_id: int | None = None,
        approval_status: str | None = None,
        supplier_name: str | None = None,
        keyword: str | None = None,
    ):
        items, total = await self.repo.list_prices(
            page=page,
            page_size=page_size,
            sku_id=sku_id,
            level1_category_id=level1_category_id,
            approval_status=approval_status,
            supplier_name=supplier_name,
            keyword=keyword,
        )
        return PriceListResponse.model_validate(
            {
                "items": [self._serialize_list_item(item, current_user.role) for item in items],
                "total": total,
                "page": page,
                "page_size": page_size,
            }
        )

    async def update_price(self, price_id: int, data: PriceUpdate, current_user: User):
        price = await self.repo.get_with_related(price_id)
        if price is None:
            raise BusinessError("价格不存在", code="NOT_FOUND", status_code=404)

        if price.approval_status == PriceApprovalStatus.PENDING.value:
            raise BusinessError(self.PENDING_EDIT_FORBIDDEN_MESSAGE)

        target_sku_id = data.sku_id if data.sku_id is not None else price.sku_id
        if (
            data.sku_id is not None
            and data.sku_id != price.sku_id
            and self._get_approved_regions(price)
        ):
            raise BusinessError(self.SKU_CHANGE_FORBIDDEN_MESSAGE)
        target_sku = await self._get_sku_or_raise(target_sku_id)
        await self._ensure_unique_price_for_sku(
            target_sku.id,
            exclude_price_id=price.id,
        )
        target_regions = (
            data.regions
            if data.regions is not None
            else [self._to_region_payload(item) for item in price.regions]
        )
        await self._ensure_unique_regions(
            target_sku.id,
            target_regions,
            exclude_price_id=price.id,
        )
        categories = await self._get_category_snapshot(target_sku)
        self._apply_snapshot(price, target_sku, categories)
        try:
            if data.regions is not None and price.approval_status == PriceApprovalStatus.ACTIVE.value:
                price.approval_status = PriceApprovalStatus.DRAFT.value
                price.submitted_at = None
                price.submitted_by = None
                price.approved_at = None
                price.approved_by = None
                price.rejected_at = None
                price.rejected_by = None
                price.rejection_reason = None
            await self.repo.save(price)

            if data.regions is not None:
                await self._replace_regions(
                    price.id,
                    data.regions,
                    version_stage=self.REGION_STAGE_DRAFT,
                )
        except IntegrityError as exc:
            await self.db.rollback()
            self._raise_translated_integrity_error(exc)

        return await self.get_price(price.id, current_user)

    async def submit_price(self, price_id: int, current_user: User):
        price = await self.repo.get_with_related(price_id)
        if price is None:
            raise BusinessError("价格不存在", code="NOT_FOUND", status_code=404)
        if price.approval_status not in {
            PriceApprovalStatus.DRAFT.value,
            PriceApprovalStatus.REJECTED.value,
        }:
            raise BusinessError(self.SUBMIT_FORBIDDEN_MESSAGE)

        draft_regions = self._get_draft_regions(price)
        if not draft_regions:
            raise BusinessError(self.NO_DRAFT_MESSAGE)

        before = self._build_audit_payload(price)
        price.approval_status = PriceApprovalStatus.PENDING.value
        price.submitted_at = datetime.now(timezone.utc)
        price.submitted_by = current_user.id
        price.rejected_at = None
        price.rejected_by = None
        price.rejection_reason = None
        await self.repo.save(price)
        refreshed = await self.repo.get_with_related(price.id)
        if refreshed is not None:
            price = refreshed
        await audit_service.log(
            user=current_user,
            action="submit_price",
            entity_type="price",
            entity_id=price.id,
            before=before,
            after=self._build_audit_payload(price),
            db=self.db,
        )
        return await self.get_price(price.id, current_user)

    async def approve_price(self, price_id: int, current_user: User):
        price = await self.repo.get_with_related(price_id)
        if price is None:
            raise BusinessError("价格不存在", code="NOT_FOUND", status_code=404)
        if price.approval_status != PriceApprovalStatus.PENDING.value:
            raise BusinessError(self.APPROVE_FORBIDDEN_MESSAGE)

        draft_regions = self._get_draft_regions(price)
        if not draft_regions:
            raise BusinessError(self.NO_DRAFT_MESSAGE)

        before = self._build_audit_payload(price)
        approved_regions = self._get_approved_regions(price)
        if approved_regions:
            await self.repo.soft_delete_regions(approved_regions)

        for index, region in enumerate(draft_regions):
            approved_region = PriceRegion(
                price_id=price.id,
                version_stage=self.REGION_STAGE_APPROVED,
                country_code=region.country_code,
                country_name=region.country_name,
                currency=region.currency,
                sale_price=region.sale_price,
                list_price=region.list_price,
                remarks=region.remarks,
                sort_order=region.sort_order if region.sort_order is not None else index,
            )
            await self.repo.save_region(approved_region)

        await self.repo.soft_delete_regions(draft_regions)
        price.approval_status = PriceApprovalStatus.ACTIVE.value
        price.approved_at = datetime.now(timezone.utc)
        price.approved_by = current_user.id
        price.rejected_at = None
        price.rejected_by = None
        price.rejection_reason = None
        await self.repo.save(price)
        refreshed = await self.repo.get_with_related(price.id)
        if refreshed is not None:
            price = refreshed
        await audit_service.log(
            user=current_user,
            action="approve_price",
            entity_type="price",
            entity_id=price.id,
            before=before,
            after=self._build_audit_payload(price),
            db=self.db,
        )
        return await self.get_price(price.id, current_user)

    async def reject_price(
        self,
        price_id: int,
        data: PriceRejectRequest,
        current_user: User,
    ):
        price = await self.repo.get_with_related(price_id)
        if price is None:
            raise BusinessError("价格不存在", code="NOT_FOUND", status_code=404)
        if price.approval_status != PriceApprovalStatus.PENDING.value:
            raise BusinessError(self.REJECT_FORBIDDEN_MESSAGE)

        before = self._build_audit_payload(price)
        price.approval_status = PriceApprovalStatus.REJECTED.value
        price.rejected_at = datetime.now(timezone.utc)
        price.rejected_by = current_user.id
        price.rejection_reason = data.reason
        await self.repo.save(price)
        refreshed = await self.repo.get_with_related(price.id)
        if refreshed is not None:
            price = refreshed
        await audit_service.log(
            user=current_user,
            action="reject_price",
            entity_type="price",
            entity_id=price.id,
            before=before,
            after=self._build_audit_payload(price),
            db=self.db,
        )
        return await self.get_price(price.id, current_user)

    async def delete_price(self, price_id: int, current_user: User) -> None:
        del current_user
        price = await self.repo.get_with_related(price_id)
        if price is None:
            raise BusinessError("价格不存在", code="NOT_FOUND", status_code=404)
        if price.regions:
            await self.repo.soft_delete_regions(list(price.regions))
        await self.repo.soft_delete(price)

    async def _get_sku_or_raise(self, sku_id: int) -> SKU:
        sku = await self.sku_repo.get_with_related(sku_id)
        if sku is None:
            raise BusinessError("SKU不存在", code="NOT_FOUND", status_code=404)
        if sku.spu is None:
            raise BusinessError("SKU关联的SPU不存在", code="NOT_FOUND", status_code=404)
        return sku

    async def _get_category_snapshot(
        self,
        sku: SKU,
    ) -> tuple[ProductCategory, ProductCategory, ProductCategory]:
        level1 = await self.category_repo.get_by_id(sku.level1_category_id)
        level2 = await self.category_repo.get_by_id(sku.level2_category_id)
        level3 = await self.category_repo.get_by_id(sku.level3_category_id)

        if level1 is None:
            raise BusinessError("一级分类不存在", code="NOT_FOUND", status_code=404)
        if level2 is None:
            raise BusinessError("二级分类不存在", code="NOT_FOUND", status_code=404)
        if level3 is None:
            raise BusinessError("三级分类不存在", code="NOT_FOUND", status_code=404)
        return level1, level2, level3

    async def _ensure_unique_regions(
        self,
        sku_id: int,
        regions: list[PriceRegionPayload],
        *,
        exclude_price_id: int | None = None,
    ) -> None:
        country_codes = [region.country_code for region in regions]
        if len(country_codes) != len(set(country_codes)):
            raise BusinessError(self.DUPLICATE_REGION_MESSAGE)

        conflict = await self.repo.find_conflicting_region(
            sku_id=sku_id,
            country_codes=country_codes,
            exclude_price_id=exclude_price_id,
        )
        if conflict is not None:
            raise BusinessError(self.DUPLICATE_REGION_MESSAGE)

    async def _ensure_unique_price_for_sku(
        self,
        sku_id: int,
        *,
        exclude_price_id: int | None = None,
    ) -> None:
        existing = await self.repo.get_by_sku_id(sku_id)
        if existing is not None and existing.id != exclude_price_id:
            raise BusinessError(self.DUPLICATE_PRICE_MESSAGE)

    def _apply_snapshot(
        self,
        price: Price,
        sku: SKU,
        categories: tuple[ProductCategory, ProductCategory, ProductCategory],
    ) -> None:
        price.sku_id = sku.id
        price.sku_code = sku.code
        price.sku_name_zh = sku.name_zh
        price.sku_name_en = sku.name_en
        price.spu_id = sku.spu_id
        price.spu_code = sku.spu.code
        price.spu_name = sku.spu.name
        price.level1_category_id = categories[0].id
        price.level1_category_code = categories[0].code
        price.level1_category_name = categories[0].name
        price.level2_category_id = categories[1].id
        price.level2_category_code = categories[1].code
        price.level2_category_name = categories[1].name
        price.level3_category_id = categories[2].id
        price.level3_category_code = categories[2].code
        price.level3_category_name = categories[2].name
        price.purchase_price = sku.spu.purchase_price
        price.supplier_name = sku.supplier_name
        price.product_model = sku.product_model
        price.product_status = sku.product_status

    async def _replace_regions(
        self,
        price_id: int,
        regions: list[PriceRegionPayload],
        *,
        version_stage: str,
    ) -> None:
        existing = await self.repo.list_active_regions(price_id, version_stage=version_stage)
        if existing:
            await self.repo.soft_delete_regions(existing)

        country_label_map = await self._get_country_label_map()

        for index, payload in enumerate(regions):
            region = PriceRegion(
                price_id=price_id,
                version_stage=version_stage,
                country_code=payload.country_code,
                country_name=country_label_map.get(
                    payload.country_code,
                    payload.country_name,
                ),
                currency=payload.currency,
                sale_price=payload.sale_price,
                list_price=payload.list_price,
                remarks=payload.remarks,
                sort_order=payload.sort_order if payload.sort_order is not None else index,
            )
            await self.repo.save_region(region)

    async def _get_country_label_map(self) -> dict[str, str]:
        items = await self.enum_repo.list_enabled_by_group(self.COUNTRY_REGION_GROUP)
        return {item.enum_key: item.enum_value for item in items}

    def _to_region_payload(self, region: PriceRegion) -> PriceRegionPayload:
        return PriceRegionPayload.model_validate(
            {
                "country_code": region.country_code,
                "country_name": region.country_name,
                "currency": region.currency,
                "sale_price": region.sale_price,
                "list_price": region.list_price,
                "remarks": region.remarks,
                "sort_order": region.sort_order,
            }
        )

    def _get_draft_regions(self, price: Price) -> list[PriceRegion]:
        return [
            region
            for region in price.regions
            if region.version_stage == self.REGION_STAGE_DRAFT and region.deleted_at is None
        ]

    def _get_approved_regions(self, price: Price) -> list[PriceRegion]:
        return [
            region
            for region in price.regions
            if region.version_stage == self.REGION_STAGE_APPROVED and region.deleted_at is None
        ]

    def _get_regions_for_role(
        self,
        price: Price,
        role: UserRole,
        *,
        effective_only: bool = False,
    ) -> list[PriceRegion]:
        approved_regions = self._get_approved_regions(price)
        if effective_only or not can_view_full_price(role):
            return approved_regions

        draft_regions = self._get_draft_regions(price)
        return draft_regions or approved_regions

    def _build_region_summary(self, regions: list[PriceRegion]) -> str:
        if not regions:
            return "无区域价格"
        first = regions[0]
        first_summary = f"{first.country_name} {first.currency} {first.sale_price}"
        if len(regions) == 1:
            return first_summary
        return f"{first_summary} 等{len(regions)}个区域"

    def _build_audit_payload(self, price: Price) -> dict:
        return {
            "approval_status": price.approval_status,
            "submitted_at": price.submitted_at,
            "submitted_by": price.submitted_by,
            "approved_at": price.approved_at,
            "approved_by": price.approved_by,
            "rejected_at": price.rejected_at,
            "rejected_by": price.rejected_by,
            "rejection_reason": price.rejection_reason,
            "draft_regions": [
                self._serialize_region_for_audit(region)
                for region in self._get_draft_regions(price)
            ],
            "approved_regions": [
                self._serialize_region_for_audit(region)
                for region in self._get_approved_regions(price)
            ],
        }

    def _serialize_region_for_audit(self, region: PriceRegion) -> dict:
        return {
            "country_code": region.country_code,
            "country_name": region.country_name,
            "currency": region.currency,
            "sale_price": region.sale_price,
            "list_price": region.list_price,
            "remarks": region.remarks,
            "sort_order": region.sort_order,
            "version_stage": region.version_stage,
        }

    def _serialize_list_item(self, price: Price, role: UserRole) -> PriceListItem:
        visible_regions = self._get_regions_for_role(price, role)
        payload = {
            "id": price.id,
            "sku_id": price.sku_id,
            "sku_code": price.sku_code,
            "sku_name_zh": price.sku_name_zh,
            "sku_name_en": price.sku_name_en,
            "spu_id": price.spu_id,
            "spu_code": price.spu_code,
            "spu_name": price.spu_name,
            "level1_category_id": price.level1_category_id,
            "level1_category_code": price.level1_category_code,
            "level1_category_name": price.level1_category_name,
            "level2_category_id": price.level2_category_id,
            "level2_category_code": price.level2_category_code,
            "level2_category_name": price.level2_category_name,
            "level3_category_id": price.level3_category_id,
            "level3_category_code": price.level3_category_code,
            "level3_category_name": price.level3_category_name,
            "supplier_name": price.supplier_name,
            "product_model": price.product_model,
            "product_status": price.product_status,
            "approval_status": price.approval_status,
            "rejection_reason": price.rejection_reason,
            "submitted_at": price.submitted_at,
            "submitted_by": price.submitted_by,
            "approved_at": price.approved_at,
            "approved_by": price.approved_by,
            "rejected_at": price.rejected_at,
            "rejected_by": price.rejected_by,
            "region_summary": self._build_region_summary(visible_regions),
            "updated_at": price.updated_at,
            "created_at": price.created_at,
        }
        if can_view_purchase_price(role):
            payload["purchase_price"] = price.purchase_price
        return PriceListItem.model_validate(payload)

    def _serialize_detail(
        self,
        price: Price,
        role: UserRole,
        *,
        effective_only: bool = False,
    ) -> PriceDetail:
        visible_regions = self._get_regions_for_role(price, role, effective_only=effective_only)
        payload = {
            "id": price.id,
            "sku_id": price.sku_id,
            "sku_code": price.sku_code,
            "sku_name_zh": price.sku_name_zh,
            "sku_name_en": price.sku_name_en,
            "spu_id": price.spu_id,
            "spu_code": price.spu_code,
            "spu_name": price.spu_name,
            "level1_category_id": price.level1_category_id,
            "level1_category_code": price.level1_category_code,
            "level1_category_name": price.level1_category_name,
            "level2_category_id": price.level2_category_id,
            "level2_category_code": price.level2_category_code,
            "level2_category_name": price.level2_category_name,
            "level3_category_id": price.level3_category_id,
            "level3_category_code": price.level3_category_code,
            "level3_category_name": price.level3_category_name,
            "supplier_name": price.supplier_name,
            "product_model": price.product_model,
            "product_status": price.product_status,
            "approval_status": (
                PriceApprovalStatus.ACTIVE.value
                if effective_only
                else price.approval_status
            ),
            "rejection_reason": None if effective_only else price.rejection_reason,
            "submitted_at": None if effective_only else price.submitted_at,
            "submitted_by": None if effective_only else price.submitted_by,
            "approved_at": None if effective_only else price.approved_at,
            "approved_by": None if effective_only else price.approved_by,
            "rejected_at": None if effective_only else price.rejected_at,
            "rejected_by": None if effective_only else price.rejected_by,
            "region_summary": self._build_region_summary(visible_regions),
            "created_at": price.created_at,
            "updated_at": price.updated_at,
        }
        if can_view_purchase_price(role):
            payload["purchase_price"] = price.purchase_price
        if effective_only or can_view_full_price(role):
            payload["regions"] = [
                PriceRegionResponse.model_validate(region)
                for region in visible_regions
            ]
        return PriceDetail.model_validate(payload)

    def _raise_translated_integrity_error(self, exc: IntegrityError) -> None:
        translated = translate_integrity_error(exc)
        if translated is not None:
            raise translated from exc
        raise exc
