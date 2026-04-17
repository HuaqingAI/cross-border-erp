from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_product_or_admin
from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.spu import (
    SPUCreate,
    SPUDetailFull,
    SPUDetailPublic,
    SPUListResponseFull,
    SPUListResponsePublic,
    SPUUpdate,
)
from app.services.spus import SPUService

router = APIRouter(prefix="/spus", tags=["SPU"])


@router.post(
    "",
    response_model=SPUDetailFull,
    status_code=status.HTTP_201_CREATED,
)
async def create_spu(
    data: SPUCreate,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = SPUService(db)
    return await service.create_spu(data, current_user)


@router.get("", response_model=SPUListResponseFull | SPUListResponsePublic)
async def list_spus(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    level1_category_id: int | None = Query(default=None, ge=1),
    level2_category_id: int | None = Query(default=None, ge=1),
    level3_category_id: int | None = Query(default=None, ge=1),
    supplier_name: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SPUService(db)
    return await service.list_spus(
        current_user,
        page=page,
        page_size=page_size,
        level1_category_id=level1_category_id,
        level2_category_id=level2_category_id,
        level3_category_id=level3_category_id,
        supplier_name=supplier_name,
        keyword=keyword,
    )


@router.get("/{spu_id}", response_model=SPUDetailFull | SPUDetailPublic)
async def get_spu(
    spu_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SPUService(db)
    return await service.get_spu(spu_id, current_user)


@router.patch("/{spu_id}", response_model=SPUDetailFull)
async def update_spu(
    spu_id: int,
    data: SPUUpdate,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = SPUService(db)
    return await service.update_spu(spu_id, data, current_user)
