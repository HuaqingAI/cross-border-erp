from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_product_or_admin
from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.product_category import (
    ProductCategoryCreate,
    ProductCategoryResponse,
    ProductCategorySortUpdate,
    ProductCategoryTreeNode,
    ProductCategoryUpdate,
)
from app.services.product_categories import ProductCategoryService

router = APIRouter(prefix="/products/categories", tags=["产品分类"])


@router.get("/tree", response_model=list[ProductCategoryTreeNode])
async def get_category_tree(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ProductCategoryService(db)
    return await service.get_tree()


@router.post(
    "",
    response_model=ProductCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    data: ProductCategoryCreate,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = ProductCategoryService(db)
    return await service.create_category(data)


@router.patch("/{category_id}", response_model=ProductCategoryResponse)
async def update_category(
    category_id: int,
    data: ProductCategoryUpdate,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = ProductCategoryService(db)
    return await service.update_category(category_id, data)


@router.patch("/{category_id}/sort", response_model=ProductCategoryResponse)
async def update_category_sort(
    category_id: int,
    data: ProductCategorySortUpdate,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = ProductCategoryService(db)
    return await service.update_sort(category_id, data)


@router.delete("/{category_id}")
async def delete_category(
    category_id: int,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = ProductCategoryService(db)
    await service.delete_category(category_id)
    return {"message": "删除成功"}
