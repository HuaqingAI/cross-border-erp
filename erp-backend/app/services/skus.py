from __future__ import annotations

from app.core.config import settings
from app.core.exceptions import BusinessError
from app.core.storage import delete_file, get_file_url
from app.models.sku import SKU, SKUPackageDetail, SKUImage
from app.models.spu import SPU
from app.models.user import User
from app.repositories.skus import SKURepository
from app.repositories.spus import SPURepository
from app.schemas.sku import (
    SKUCreate,
    SKUCustomsInfoUpdate,
    SKUDetail,
    SKUImageCreate,
    SKUImageResponse,
    SKUPackageDetailPayload,
    SKUPackageDetailResponse,
    SKUListItem,
    SKUListResponse,
    SKUProductStatus,
    SKUUpdate,
)
from sqlalchemy.ext.asyncio import AsyncSession


class SKUService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = SKURepository(db)
        self.spu_repo = SPURepository(db)

    async def create_sku(self, data: SKUCreate, current_user: User):
        await self._ensure_unique_code(data.code)
        spu = await self._get_spu_or_raise(data.spu_id)

        sku = SKU(
            spu_id=spu.id,
            code=data.code,
            name_zh=data.name_zh,
            name_en=data.name_en,
            product_model=data.product_model,
            product_type=data.product_type.value,
            core_params=data.core_params,
            product_status=(data.product_status or SKUProductStatus.ACTIVE).value,
            electrical_params=data.electrical_params,
            principle=data.principle,
            usage=data.usage,
            material=data.material,
            unit=data.unit,
            has_plug=data.has_plug,
            is_special=data.is_special,
            special_notes=data.special_notes,
            package_type=data.package_type,
            package_quantity=data.package_quantity,
            customs_info_ready=False,
        )
        self._apply_inherited_fields(sku, spu)

        await self.repo.save(sku)
        await self._replace_package_details(sku.id, data.package_details)
        return await self.get_sku(sku.id, current_user)

    async def get_sku(self, sku_id: int, current_user: User):
        del current_user
        sku = await self.repo.get_with_related(sku_id)
        if sku is None:
            raise BusinessError("SKU不存在", code="NOT_FOUND", status_code=404)
        package_details = await self.repo.list_active_package_details(sku_id)
        images = await self.repo.list_active_images(sku_id)
        return self._serialize_detail(sku, package_details, images)

    async def list_skus(
        self,
        current_user: User,
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
    ):
        del current_user
        items, total = await self.repo.list_skus(
            page=page,
            page_size=page_size,
            spu_id=spu_id,
            level1_category_id=level1_category_id,
            level2_category_id=level2_category_id,
            level3_category_id=level3_category_id,
            supplier_name=supplier_name,
            product_status=product_status,
            product_type=product_type,
            keyword=keyword,
        )
        return SKUListResponse.model_validate(
            {
                "items": [self._serialize_list_item(item) for item in items],
                "total": total,
                "page": page,
                "page_size": page_size,
            }
        )

    async def update_sku(self, sku_id: int, data: SKUUpdate, current_user: User):
        sku = await self.repo.get_with_related(sku_id)
        if sku is None:
            raise BusinessError("SKU不存在", code="NOT_FOUND", status_code=404)

        if "code" in data.model_fields_set and data.code != sku.code:
            raise BusinessError("SKU编码创建后不可修改")

        target_spu = sku.spu
        if data.spu_id is not None and data.spu_id != sku.spu_id:
            target_spu = await self._get_spu_or_raise(data.spu_id)
            sku.spu_id = target_spu.id
        elif target_spu is None:
            target_spu = await self._get_spu_or_raise(sku.spu_id)

        if data.name_zh is not None:
            sku.name_zh = data.name_zh
        if data.name_en is not None:
            sku.name_en = data.name_en
        if data.product_model is not None:
            sku.product_model = data.product_model
        if data.product_type is not None:
            sku.product_type = data.product_type.value
        if data.core_params is not None:
            sku.core_params = data.core_params
        if data.product_status is not None:
            sku.product_status = data.product_status.value
        if "electrical_params" in data.model_fields_set:
            sku.electrical_params = data.electrical_params
        if data.principle is not None:
            sku.principle = data.principle
        if data.usage is not None:
            sku.usage = data.usage
        if "material" in data.model_fields_set:
            sku.material = data.material
        if data.unit is not None:
            sku.unit = data.unit
        if data.has_plug is not None:
            sku.has_plug = data.has_plug
        if data.is_special is not None:
            sku.is_special = data.is_special
        if "special_notes" in data.model_fields_set:
            sku.special_notes = data.special_notes
        if "package_type" in data.model_fields_set:
            sku.package_type = data.package_type
        if "package_quantity" in data.model_fields_set:
            sku.package_quantity = data.package_quantity

        self._apply_inherited_fields(sku, target_spu)
        await self.repo.save(sku)

        if data.package_details is not None:
            await self._replace_package_details(sku.id, data.package_details)

        return await self.get_sku(sku.id, current_user)

    async def update_customs_info(
        self,
        sku_id: int,
        data: SKUCustomsInfoUpdate,
        current_user: User,
    ):
        sku = await self.repo.get_with_related(sku_id)
        if sku is None:
            raise BusinessError("SKU不存在", code="NOT_FOUND", status_code=404)

        if "customs_hscode" in data.model_fields_set:
            sku.customs_hscode = data.customs_hscode
        if "customs_supervision_condition" in data.model_fields_set:
            sku.customs_supervision_condition = data.customs_supervision_condition
        if "customs_declaration_elements" in data.model_fields_set:
            sku.customs_declaration_elements = data.customs_declaration_elements
        if "customs_refund_tax_rate" in data.model_fields_set:
            sku.customs_refund_tax_rate = data.customs_refund_tax_rate
        if "customs_info_ready" in data.model_fields_set and data.customs_info_ready is not None:
            sku.customs_info_ready = data.customs_info_ready

        await self.repo.save(sku)
        return await self.get_sku(sku.id, current_user)

    async def add_image(
        self,
        sku_id: int,
        data: SKUImageCreate,
        current_user: User,
    ):
        sku = await self.repo.get_with_related(sku_id)
        if sku is None:
            raise BusinessError("SKU不存在", code="NOT_FOUND", status_code=404)

        if not data.object_key.startswith("sku-images/"):
            raise BusinessError("SKU图片对象键非法")

        expected_file_url = get_file_url(
            data.object_key,
            bucket_name=settings.MINIO_SKU_IMAGE_BUCKET,
        )
        if data.file_url != expected_file_url:
            raise BusinessError("SKU图片URL与对象键不匹配")

        images = await self.repo.list_active_images(sku_id)
        image = SKUImage(
            sku_id=sku_id,
            object_key=data.object_key,
            file_url=expected_file_url,
            filename=data.filename,
            content_type=data.content_type,
            sort_order=data.sort_order if data.sort_order is not None else len(images),
        )
        await self.repo.save_image(image)
        return await self.get_sku(sku.id, current_user)

    async def delete_image(
        self,
        sku_id: int,
        image_id: int,
        current_user: User,
    ):
        sku = await self.repo.get_with_related(sku_id)
        if sku is None:
            raise BusinessError("SKU不存在", code="NOT_FOUND", status_code=404)

        image = await self.repo.get_active_image(sku_id, image_id)
        if image is None:
            raise BusinessError("SKU图片不存在", code="NOT_FOUND", status_code=404)

        await self.repo.soft_delete_image(image)
        self._enqueue_post_commit_delete(image.object_key)
        return await self.get_sku(sku.id, current_user)

    async def _ensure_unique_code(self, code: str) -> None:
        if await self.repo.get_by_code(code):
            raise BusinessError("SKU编码已存在")

    async def _get_spu_or_raise(self, spu_id: int) -> SPU:
        spu = await self.spu_repo.get_by_id(spu_id)
        if spu is None:
            raise BusinessError("SPU不存在", code="NOT_FOUND", status_code=404)
        return spu

    def _apply_inherited_fields(self, sku: SKU, spu: SPU) -> None:
        sku.level1_category_id = spu.level1_category_id
        sku.level2_category_id = spu.level2_category_id
        sku.level3_category_id = spu.level3_category_id
        sku.supplier_name = spu.supplier_name
        sku.restricted_countries = list(spu.restricted_countries or [])
        sku.customer_warranty_months = spu.customer_warranty_months

    def _enqueue_post_commit_delete(self, object_key: str) -> None:
        post_commit_hooks = self.db.info.setdefault("post_commit_hooks", [])

        async def _delete() -> None:
            await delete_file(object_key)

        post_commit_hooks.append(_delete)

    async def _replace_package_details(
        self,
        sku_id: int,
        package_details: list[SKUPackageDetailPayload],
    ) -> None:
        existing = await self.repo.list_active_package_details(sku_id)
        if existing:
            await self.repo.soft_delete_package_details(existing)

        for index, payload in enumerate(package_details):
            package_detail = SKUPackageDetail(
                sku_id=sku_id,
                net_weight_kg=payload.net_weight_kg,
                gross_weight_kg=payload.gross_weight_kg,
                length_cm=payload.length_cm,
                width_cm=payload.width_cm,
                height_cm=payload.height_cm,
                volume_cbm=payload.volume_cbm,
                sort_order=payload.sort_order if payload.sort_order is not None else index,
            )
            await self.repo.save_package_detail(package_detail)

    def _serialize_list_item(self, sku: SKU):
        if sku.spu is None:
            raise BusinessError("SKU关联的SPU不存在", code="NOT_FOUND", status_code=404)
        return SKUListItem.model_validate(
            {
                "id": sku.id,
                "spu_id": sku.spu_id,
                "spu_code": sku.spu.code,
                "spu_name": sku.spu.name,
                "code": sku.code,
                "name_zh": sku.name_zh,
                "name_en": sku.name_en,
                "product_model": sku.product_model,
                "product_type": sku.product_type,
                "level1_category_id": sku.level1_category_id,
                "level2_category_id": sku.level2_category_id,
                "level3_category_id": sku.level3_category_id,
                "supplier_name": sku.supplier_name,
                "product_status": sku.product_status,
                "customer_warranty_months": sku.customer_warranty_months,
                "created_at": sku.created_at,
            }
        )

    def _serialize_detail(
        self,
        sku: SKU,
        package_details: list[SKUPackageDetail],
        images: list[SKUImage],
    ):
        if sku.spu is None:
            raise BusinessError("SKU关联的SPU不存在", code="NOT_FOUND", status_code=404)
        return SKUDetail.model_validate(
            {
                "id": sku.id,
                "spu_id": sku.spu_id,
                "spu_code": sku.spu.code,
                "spu_name": sku.spu.name,
                "code": sku.code,
                "name_zh": sku.name_zh,
                "name_en": sku.name_en,
                "product_model": sku.product_model,
                "product_type": sku.product_type,
                "level1_category_id": sku.level1_category_id,
                "level2_category_id": sku.level2_category_id,
                "level3_category_id": sku.level3_category_id,
                "supplier_name": sku.supplier_name,
                "restricted_countries": sku.restricted_countries,
                "customer_warranty_months": sku.customer_warranty_months,
                "core_params": sku.core_params,
                "product_status": sku.product_status,
                "electrical_params": sku.electrical_params,
                "principle": sku.principle,
                "usage": sku.usage,
                "material": sku.material,
                "unit": sku.unit,
                "has_plug": sku.has_plug,
                "is_special": sku.is_special,
                "special_notes": sku.special_notes,
                "package_type": sku.package_type,
                "package_quantity": sku.package_quantity,
                "package_details": [
                    SKUPackageDetailResponse.model_validate(detail)
                    for detail in package_details
                ],
                "images": [SKUImageResponse.model_validate(image) for image in images],
                "customs_hscode": sku.customs_hscode,
                "customs_supervision_condition": sku.customs_supervision_condition,
                "customs_declaration_elements": sku.customs_declaration_elements,
                "customs_refund_tax_rate": sku.customs_refund_tax_rate,
                "customs_info_ready": sku.customs_info_ready,
                "created_at": sku.created_at,
                "updated_at": sku.updated_at,
            }
        )
