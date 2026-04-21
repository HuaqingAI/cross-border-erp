from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_finance_or_admin, require_price_read
from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.price import PriceCreate, PriceDetail, PriceListResponse, PriceUpdate
from app.services.prices import PriceService

router = APIRouter(prefix="/prices", tags=["Prices"])


@router.post("", response_model=PriceDetail, status_code=status.HTTP_201_CREATED)
async def create_price(
    data: PriceCreate,
    current_user: User = Depends(require_finance_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = PriceService(db)
    return await service.create_price(data, current_user)


@router.get("", response_model=PriceListResponse)
async def list_prices(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sku_id: int | None = Query(default=None),
    level1_category_id: int | None = Query(default=None),
    supplier_name: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    current_user: User = Depends(require_price_read),
    db: AsyncSession = Depends(get_db),
):
    service = PriceService(db)
    return await service.list_prices(
        current_user,
        page=page,
        page_size=page_size,
        sku_id=sku_id,
        level1_category_id=level1_category_id,
        supplier_name=supplier_name,
        keyword=keyword,
    )


@router.get("/{price_id}", response_model=PriceDetail)
async def get_price(
    price_id: int,
    current_user: User = Depends(require_price_read),
    db: AsyncSession = Depends(get_db),
):
    service = PriceService(db)
    return await service.get_price(price_id, current_user)


@router.patch("/{price_id}", response_model=PriceDetail)
async def update_price(
    price_id: int,
    data: PriceUpdate,
    current_user: User = Depends(require_finance_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = PriceService(db)
    return await service.update_price(price_id, data, current_user)


@router.delete("/{price_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_price(
    price_id: int,
    current_user: User = Depends(require_finance_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = PriceService(db)
    await service.delete_price(price_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
