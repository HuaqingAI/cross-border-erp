from __future__ import annotations

from app.core.exceptions import BusinessError, translate_integrity_error
from app.core.permissions import can_view_full_price, can_view_purchase_price
from app.models.price import Price, PriceRegion
from app.models.product_category import ProductCategory
from app.models.sku import SKU
from app.models.user import User, UserRole
from app.repositories.prices import PriceRepository
from app.repositories.product_categories import ProductCategoryRepository
from app.repositories.skus import SKURepository
from app.schemas.price import (
    PriceCreate,
    PriceDetail,
    PriceListItem,
    PriceListResponse,
    PriceRegionPayload,
    PriceRegionResponse,
    PriceUpdate,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


class PriceService:
    DUPLICATE_PRICE_MESSAGE = "该SKU已存在价格记录"
    DUPLICATE_REGION_MESSAGE = "同一 SKU 同一国家/地区不可重复设置价格"

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PriceRepository(db)
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
        )
        try:
            await self.repo.save(price)
            await self._replace_regions(price.id, data.regions)
        except IntegrityError as exc:
            await self.db.rollback()
            self._raise_translated_integrity_error(exc)
        return await self.get_price(price.id, current_user)

    async def get_price(self, price_id: int, current_user: User):
        price = await self.repo.get_with_related(price_id)
        if price is None:
            raise BusinessError("价格不存在", code="NOT_FOUND", status_code=404)
        return self._serialize_detail(price, current_user.role)

    async def list_prices(
        self,
        current_user: User,
        *,
        page: int,
        page_size: int,
        sku_id: int | None = None,
        level1_category_id: int | None = None,
        supplier_name: str | None = None,
        keyword: str | None = None,
    ):
        items, total = await self.repo.list_prices(
            page=page,
            page_size=page_size,
            sku_id=sku_id,
            level1_category_id=level1_category_id,
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

        target_sku_id = data.sku_id if data.sku_id is not None else price.sku_id
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
            await self.repo.save(price)

            if data.regions is not None:
                await self._replace_regions(price.id, data.regions)
        except IntegrityError as exc:
            await self.db.rollback()
            self._raise_translated_integrity_error(exc)

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
    ) -> None:
        existing = await self.repo.list_active_regions(price_id)
        if existing:
            await self.repo.soft_delete_regions(existing)

        for index, payload in enumerate(regions):
            region = PriceRegion(
                price_id=price_id,
                country_code=payload.country_code,
                country_name=payload.country_name,
                currency=payload.currency,
                sale_price=payload.sale_price,
                list_price=payload.list_price,
                remarks=payload.remarks,
                sort_order=payload.sort_order if payload.sort_order is not None else index,
            )
            await self.repo.save_region(region)

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

    def _build_region_summary(self, price: Price) -> str:
        if not price.regions:
            return "无区域价格"
        first = price.regions[0]
        first_summary = f"{first.country_name} {first.currency} {first.sale_price}"
        if len(price.regions) == 1:
            return first_summary
        return f"{first_summary} 等{len(price.regions)}个区域"

    def _serialize_list_item(self, price: Price, role: UserRole) -> PriceListItem:
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
            "region_summary": self._build_region_summary(price),
            "updated_at": price.updated_at,
            "created_at": price.created_at,
        }
        if can_view_purchase_price(role):
            payload["purchase_price"] = price.purchase_price
        return PriceListItem.model_validate(payload)

    def _serialize_detail(self, price: Price, role: UserRole) -> PriceDetail:
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
            "region_summary": self._build_region_summary(price),
            "created_at": price.created_at,
            "updated_at": price.updated_at,
        }
        if can_view_purchase_price(role):
            payload["purchase_price"] = price.purchase_price
        if can_view_full_price(role):
            payload["regions"] = [
                PriceRegionResponse.model_validate(region)
                for region in price.regions
            ]
        return PriceDetail.model_validate(payload)

    def _raise_translated_integrity_error(self, exc: IntegrityError) -> None:
        translated = translate_integrity_error(exc)
        if translated is not None:
            raise translated from exc
        raise exc
