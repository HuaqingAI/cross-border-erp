from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_product_or_admin
from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.product_document import (
    ProductDocumentCreate,
    ProductDocumentDetail,
    ProductDocumentListResponse,
    ProductDocumentOwnershipType,
    ProductDocumentUpdate,
)
from app.services.product_documents import ProductDocumentService

router = APIRouter(prefix="/products/documents", tags=["Product Documents"])


@router.post("", response_model=ProductDocumentDetail, status_code=status.HTTP_201_CREATED)
async def create_product_document(
    data: ProductDocumentCreate,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = ProductDocumentService(db)
    return await service.create_product_document(data, current_user)


@router.get("", response_model=ProductDocumentListResponse)
async def list_product_documents(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    document_type: str | None = Query(default=None),
    ownership_type: ProductDocumentOwnershipType | None = Query(default=None),
    keyword: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ProductDocumentService(db)
    return await service.list_product_documents(
        current_user,
        page=page,
        page_size=page_size,
        document_type=document_type,
        ownership_type=ownership_type.value if ownership_type else None,
        keyword=keyword,
    )


@router.get("/{product_document_id}", response_model=ProductDocumentDetail)
async def get_product_document(
    product_document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ProductDocumentService(db)
    return await service.get_product_document(product_document_id, current_user)


@router.patch("/{product_document_id}", response_model=ProductDocumentDetail)
async def update_product_document(
    product_document_id: int,
    data: ProductDocumentUpdate,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = ProductDocumentService(db)
    return await service.update_product_document(
        product_document_id,
        data,
        current_user,
    )


@router.delete("/{product_document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_document(
    product_document_id: int,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = ProductDocumentService(db)
    await service.delete_product_document(product_document_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
