from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_customs_info_editor, require_product_or_admin
from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.sku import (
    SKUCreate,
    SKUCustomsInfoUpdate,
    SKUDetail,
    SKUListResponse,
    SKUProductStatus,
    SKUProductType,
    SKUUpdate,
)
from app.services.skus import SKUService

router = APIRouter(prefix="/skus", tags=["SKU"])


@router.post(
    "",
    response_model=SKUDetail,
    status_code=status.HTTP_201_CREATED,
)
async def create_sku(
    data: SKUCreate,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = SKUService(db)
    return await service.create_sku(data, current_user)


@router.get("", response_model=SKUListResponse)
async def list_skus(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    spu_id: int | None = Query(default=None, ge=1),
    level1_category_id: int | None = Query(default=None, ge=1),
    level2_category_id: int | None = Query(default=None, ge=1),
    level3_category_id: int | None = Query(default=None, ge=1),
    supplier_name: str | None = Query(default=None),
    product_status: SKUProductStatus | None = Query(default=None),
    product_type: SKUProductType | None = Query(default=None),
    keyword: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SKUService(db)
    return await service.list_skus(
        current_user,
        page=page,
        page_size=page_size,
        spu_id=spu_id,
        level1_category_id=level1_category_id,
        level2_category_id=level2_category_id,
        level3_category_id=level3_category_id,
        supplier_name=supplier_name,
        product_status=product_status.value if product_status else None,
        product_type=product_type.value if product_type else None,
        keyword=keyword,
    )


@router.get("/{sku_id}", response_model=SKUDetail)
async def get_sku(
    sku_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SKUService(db)
    return await service.get_sku(sku_id, current_user)


@router.patch("/{sku_id}", response_model=SKUDetail)
async def update_sku(
    sku_id: int,
    data: SKUUpdate,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = SKUService(db)
    return await service.update_sku(sku_id, data, current_user)


@router.patch("/{sku_id}/customs-info", response_model=SKUDetail)
async def update_sku_customs_info(
    sku_id: int,
    data: SKUCustomsInfoUpdate,
    current_user: User = Depends(require_customs_info_editor),
    db: AsyncSession = Depends(get_db),
):
    service = SKUService(db)
    return await service.update_customs_info(sku_id, data, current_user)
