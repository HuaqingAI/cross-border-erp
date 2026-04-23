from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessError
from app.models.certificate import (
    Certificate,
    CertificateCategoryAssignment,
    CertificateSPUAssignment,
)
from app.models.user import User
from app.repositories.certificates import CertificateRepository
from app.repositories.product_categories import ProductCategoryRepository
from app.repositories.spus import SPURepository
from app.schemas.certificate import (
    CertificateCreate,
    CertificateDetail,
    CertificateListItem,
    CertificateListResponse,
    CertificateOwnershipType,
    CertificateRelatedCategory,
    CertificateRelatedSPU,
    CertificateUpdate,
    CertificateValidityStatus,
)


class CertificateService:
    EXPIRING_DAYS = 30

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CertificateRepository(db)
        self.spu_repo = SPURepository(db)
        self.category_repo = ProductCategoryRepository(db)

    async def create_certificate(self, data: CertificateCreate, current_user: User):
        await self._ensure_unique_certificate_no(data.certificate_no)
        self._validate_validity_dates(data.valid_from, data.valid_to)

        ownership_type = data.ownership_type.value
        spu_ids = self._normalize_ids(data.spu_ids)
        category_ids = self._normalize_ids(data.category_ids)
        await self._validate_ownership_targets(ownership_type, spu_ids, category_ids)

        certificate = Certificate(
            name=data.name,
            certificate_no=data.certificate_no,
            certificate_type=data.certificate_type,
            issuing_authority=data.issuing_authority,
            valid_from=data.valid_from,
            valid_to=data.valid_to,
            ownership_type=ownership_type,
            file_object_key=data.file_object_key,
            file_url=data.file_url,
            file_name=data.file_name,
            remarks=data.remarks,
        )
        await self.repo.save(certificate)
        await self._replace_assignments(
            certificate.id,
            ownership_type,
            spu_ids,
            category_ids,
        )
        return await self.get_certificate(certificate.id, current_user)

    async def get_certificate(self, certificate_id: int, current_user: User):
        del current_user
        certificate = await self.repo.get_with_related(certificate_id)
        if certificate is None:
            raise BusinessError("证书不存在", code="NOT_FOUND", status_code=404)
        return self._serialize_detail(certificate)

    async def list_certificates(
        self,
        current_user: User,
        *,
        page: int,
        page_size: int,
        certificate_type: str | None = None,
        ownership_type: str | None = None,
        validity_status: str | None = None,
        keyword: str | None = None,
        aggregate_spu_id: int | None = None,
        aggregate_category_ids: list[int] | None = None,
    ):
        del current_user
        items, total = await self.repo.list_certificates(
            page=page,
            page_size=page_size,
            certificate_type=certificate_type,
            ownership_type=ownership_type,
            validity_status=validity_status,
            keyword=keyword,
            aggregate_spu_id=aggregate_spu_id,
            aggregate_category_ids=self._normalize_ids(aggregate_category_ids),
        )
        return CertificateListResponse.model_validate(
            {
                "items": [self._serialize_list_item(item) for item in items],
                "total": total,
                "page": page,
                "page_size": page_size,
            }
        )

    async def update_certificate(
        self,
        certificate_id: int,
        data: CertificateUpdate,
        current_user: User,
    ):
        certificate = await self.repo.get_with_related(certificate_id)
        if certificate is None:
            raise BusinessError("证书不存在", code="NOT_FOUND", status_code=404)

        if (
            data.certificate_no is not None
            and data.certificate_no != certificate.certificate_no
        ):
            await self._ensure_unique_certificate_no(
                data.certificate_no,
                exclude_id=certificate.id,
            )

        valid_from = data.valid_from or certificate.valid_from
        valid_to = data.valid_to or certificate.valid_to
        self._validate_validity_dates(valid_from, valid_to)

        target_ownership_type = (
            data.ownership_type.value
            if data.ownership_type is not None
            else certificate.ownership_type
        )
        current_spu_ids = [item.spu_id for item in certificate.spu_assignments]
        current_category_ids = [
            item.category_id for item in certificate.category_assignments
        ]
        requested_spu_ids = (
            self._normalize_ids(data.spu_ids)
            if "spu_ids" in data.model_fields_set
            else current_spu_ids
        )
        requested_category_ids = (
            self._normalize_ids(data.category_ids)
            if "category_ids" in data.model_fields_set
            else current_category_ids
        )
        if target_ownership_type == CertificateOwnershipType.GENERAL.value:
            target_spu_ids = []
            target_category_ids = []
        elif target_ownership_type == CertificateOwnershipType.SPU.value:
            target_spu_ids = requested_spu_ids
            target_category_ids = []
        elif target_ownership_type == CertificateOwnershipType.CATEGORY.value:
            target_spu_ids = []
            target_category_ids = requested_category_ids
        else:
            target_spu_ids = requested_spu_ids
            target_category_ids = requested_category_ids
        await self._validate_ownership_targets(
            target_ownership_type,
            target_spu_ids,
            target_category_ids,
        )

        if data.name is not None:
            certificate.name = data.name
        if data.certificate_no is not None:
            certificate.certificate_no = data.certificate_no
        if data.certificate_type is not None:
            certificate.certificate_type = data.certificate_type
        if data.issuing_authority is not None:
            certificate.issuing_authority = data.issuing_authority
        if data.valid_from is not None:
            certificate.valid_from = data.valid_from
        if data.valid_to is not None:
            certificate.valid_to = data.valid_to
        certificate.ownership_type = target_ownership_type
        if "file_object_key" in data.model_fields_set:
            certificate.file_object_key = data.file_object_key
        if "file_url" in data.model_fields_set:
            certificate.file_url = data.file_url
        if "file_name" in data.model_fields_set:
            certificate.file_name = data.file_name
        if "remarks" in data.model_fields_set:
            certificate.remarks = data.remarks

        await self.repo.save(certificate)
        await self._replace_assignments(
            certificate.id,
            target_ownership_type,
            target_spu_ids,
            target_category_ids,
        )
        return await self.get_certificate(certificate.id, current_user)

    async def delete_certificate(
        self,
        certificate_id: int,
        current_user: User,
    ) -> None:
        del current_user
        certificate = await self.repo.get_with_related(certificate_id)
        if certificate is None:
            raise BusinessError("证书不存在", code="NOT_FOUND", status_code=404)

        if certificate.spu_assignments:
            await self.repo.soft_delete_spu_assignments(certificate.spu_assignments)
        if certificate.category_assignments:
            await self.repo.soft_delete_category_assignments(
                certificate.category_assignments
            )
        await self.repo.soft_delete(certificate)

    async def _ensure_unique_certificate_no(
        self,
        certificate_no: str,
        *,
        exclude_id: int | None = None,
    ) -> None:
        existing = await self.repo.get_by_certificate_no(
            certificate_no,
            include_deleted=True,
        )
        if existing is not None and existing.id != exclude_id:
            raise BusinessError("证书编号已存在")

    def _validate_validity_dates(self, valid_from: date, valid_to: date) -> None:
        if valid_from >= valid_to:
            raise BusinessError("有效期起始日期必须早于结束日期")

    async def _validate_ownership_targets(
        self,
        ownership_type: str,
        spu_ids: list[int],
        category_ids: list[int],
    ) -> None:
        if ownership_type == CertificateOwnershipType.GENERAL.value:
            if spu_ids or category_ids:
                raise BusinessError("通用归属不能指定SPU或分类")
            return
        if ownership_type == CertificateOwnershipType.SPU.value:
            if not spu_ids:
                raise BusinessError("SPU归属至少需要选择一个SPU")
            await self._ensure_spus_exist(spu_ids)
            return
        if ownership_type == CertificateOwnershipType.CATEGORY.value:
            if not category_ids:
                raise BusinessError("分类归属至少需要选择一个分类")
            await self._ensure_categories_exist(category_ids)
            return
        raise BusinessError("证书归属类型不支持")

    async def _ensure_spus_exist(self, spu_ids: list[int]) -> None:
        for spu_id in spu_ids:
            spu = await self.spu_repo.get_by_id(spu_id)
            if spu is None:
                raise BusinessError("SPU不存在", code="NOT_FOUND", status_code=404)

    async def _ensure_categories_exist(self, category_ids: list[int]) -> None:
        for category_id in category_ids:
            category = await self.category_repo.get_by_id(category_id)
            if category is None:
                raise BusinessError("分类不存在", code="NOT_FOUND", status_code=404)

    async def _replace_assignments(
        self,
        certificate_id: int,
        ownership_type: str,
        spu_ids: list[int],
        category_ids: list[int],
    ) -> None:
        existing_spu_assignments = await self.repo.list_active_spu_assignments(
            certificate_id
        )
        existing_category_assignments = await self.repo.list_active_category_assignments(
            certificate_id
        )
        if existing_spu_assignments:
            await self.repo.soft_delete_spu_assignments(existing_spu_assignments)
        if existing_category_assignments:
            await self.repo.soft_delete_category_assignments(existing_category_assignments)

        if ownership_type == CertificateOwnershipType.SPU.value:
            for spu_id in spu_ids:
                await self.repo.save_spu_assignment(
                    CertificateSPUAssignment(
                        certificate_id=certificate_id,
                        spu_id=spu_id,
                    )
                )
        elif ownership_type == CertificateOwnershipType.CATEGORY.value:
            for category_id in category_ids:
                await self.repo.save_category_assignment(
                    CertificateCategoryAssignment(
                        certificate_id=certificate_id,
                        category_id=category_id,
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

    def _calculate_validity_status(self, valid_to: date) -> CertificateValidityStatus:
        today = date.today()
        if valid_to < today:
            return CertificateValidityStatus.EXPIRED
        if valid_to <= today + timedelta(days=self.EXPIRING_DAYS):
            return CertificateValidityStatus.EXPIRING
        return CertificateValidityStatus.VALID

    def _build_ownership_summary(self, certificate: Certificate) -> str:
        if certificate.ownership_type == CertificateOwnershipType.GENERAL.value:
            return "通用（全部产品）"
        if certificate.ownership_type == CertificateOwnershipType.SPU.value:
            count = len(certificate.spu_assignments)
            if count == 0:
                return "SPU归属"
            first = certificate.spu_assignments[0].spu
            first_name = first.name if first is not None else f"SPU {certificate.spu_assignments[0].spu_id}"
            if count == 1:
                return f"SPU：{first_name}"
            return f"SPU：{first_name} 等{count}个"

        count = len(certificate.category_assignments)
        if count == 0:
            return "按分类"
        first_category = certificate.category_assignments[0].category
        first_name = (
            first_category.name
            if first_category is not None
            else f"分类 {certificate.category_assignments[0].category_id}"
        )
        if count == 1:
            return f"分类：{first_name}"
        return f"分类：{first_name} 等{count}个"

    def _serialize_spus(
        self,
        certificate: Certificate,
    ) -> tuple[list[int], list[CertificateRelatedSPU]]:
        spu_ids: list[int] = []
        spus: list[CertificateRelatedSPU] = []
        for assignment in certificate.spu_assignments:
            spu_ids.append(assignment.spu_id)
            if assignment.spu is None:
                continue
            spus.append(
                CertificateRelatedSPU.model_validate(
                    {
                        "id": assignment.id,
                        "spu_id": assignment.spu_id,
                        "spu_code": assignment.spu.code,
                        "spu_name": assignment.spu.name,
                    }
                )
            )
        return spu_ids, spus

    def _serialize_categories(
        self,
        certificate: Certificate,
    ) -> tuple[list[int], list[CertificateRelatedCategory]]:
        category_ids: list[int] = []
        categories: list[CertificateRelatedCategory] = []
        for assignment in certificate.category_assignments:
            category_ids.append(assignment.category_id)
            if assignment.category is None:
                continue
            categories.append(
                CertificateRelatedCategory.model_validate(
                    {
                        "id": assignment.id,
                        "category_id": assignment.category_id,
                        "category_code": assignment.category.code,
                        "category_name": assignment.category.name,
                        "level": assignment.category.level,
                    }
                )
            )
        return category_ids, categories

    def _serialize_list_item(self, certificate: Certificate) -> CertificateListItem:
        validity_status = self._calculate_validity_status(certificate.valid_to)
        spu_ids, _ = self._serialize_spus(certificate)
        category_ids, _ = self._serialize_categories(certificate)
        return CertificateListItem.model_validate(
            {
                "id": certificate.id,
                "name": certificate.name,
                "certificate_no": certificate.certificate_no,
                "certificate_type": certificate.certificate_type,
                "issuing_authority": certificate.issuing_authority,
                "valid_from": certificate.valid_from,
                "valid_to": certificate.valid_to,
                "ownership_type": certificate.ownership_type,
                "ownership_summary": self._build_ownership_summary(certificate),
                "validity_status": validity_status,
                "spu_ids": spu_ids,
                "category_ids": category_ids,
                "created_at": certificate.created_at,
            }
        )

    def _serialize_detail(self, certificate: Certificate) -> CertificateDetail:
        validity_status = self._calculate_validity_status(certificate.valid_to)
        spu_ids, spus = self._serialize_spus(certificate)
        category_ids, categories = self._serialize_categories(certificate)
        return CertificateDetail.model_validate(
            {
                "id": certificate.id,
                "name": certificate.name,
                "certificate_no": certificate.certificate_no,
                "certificate_type": certificate.certificate_type,
                "issuing_authority": certificate.issuing_authority,
                "valid_from": certificate.valid_from,
                "valid_to": certificate.valid_to,
                "ownership_type": certificate.ownership_type,
                "ownership_summary": self._build_ownership_summary(certificate),
                "validity_status": validity_status,
                "spu_ids": spu_ids,
                "category_ids": category_ids,
                "spus": spus,
                "categories": categories,
                "file_object_key": certificate.file_object_key,
                "file_url": certificate.file_url,
                "file_name": certificate.file_name,
                "remarks": certificate.remarks,
                "created_at": certificate.created_at,
                "updated_at": certificate.updated_at,
            }
        )
