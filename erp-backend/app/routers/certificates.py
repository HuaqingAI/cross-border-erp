from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_product_or_admin
from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.certificate import (
    CertificateCreate,
    CertificateDetail,
    CertificateListResponse,
    CertificateOwnershipType,
    CertificateUpdate,
    CertificateValidityStatus,
)
from app.services.certificates import CertificateService

router = APIRouter(prefix="/certificates", tags=["Certificates"])


@router.post("", response_model=CertificateDetail, status_code=status.HTTP_201_CREATED)
async def create_certificate(
    data: CertificateCreate,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = CertificateService(db)
    return await service.create_certificate(data, current_user)


@router.get("", response_model=CertificateListResponse)
async def list_certificates(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    certificate_type: str | None = Query(default=None),
    ownership_type: CertificateOwnershipType | None = Query(default=None),
    validity_status: CertificateValidityStatus | None = Query(default=None),
    keyword: str | None = Query(default=None),
    aggregate_spu_id: int | None = Query(default=None, gt=0),
    aggregate_category_ids: list[int] = Query(default_factory=list),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CertificateService(db)
    return await service.list_certificates(
        current_user,
        page=page,
        page_size=page_size,
        certificate_type=certificate_type,
        ownership_type=ownership_type.value if ownership_type else None,
        validity_status=validity_status.value if validity_status else None,
        keyword=keyword,
        aggregate_spu_id=aggregate_spu_id,
        aggregate_category_ids=aggregate_category_ids,
    )


@router.get("/{certificate_id}", response_model=CertificateDetail)
async def get_certificate(
    certificate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = CertificateService(db)
    return await service.get_certificate(certificate_id, current_user)


@router.patch("/{certificate_id}", response_model=CertificateDetail)
async def update_certificate(
    certificate_id: int,
    data: CertificateUpdate,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = CertificateService(db)
    return await service.update_certificate(certificate_id, data, current_user)


@router.delete("/{certificate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_certificate(
    certificate_id: int,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = CertificateService(db)
    await service.delete_certificate(certificate_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
