from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_product_or_admin
from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.faq import FAQCreate, FAQDetail, FAQListResponse, FAQUpdate
from app.services.faqs import FAQService

router = APIRouter(prefix="/faqs", tags=["FAQs"])


@router.post("", response_model=FAQDetail, status_code=status.HTTP_201_CREATED)
async def create_faq(
    data: FAQCreate,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = FAQService(db)
    return await service.create_faq(data, current_user)


@router.get("", response_model=FAQListResponse)
async def list_faqs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    spu_id: int | None = Query(default=None),
    question_type: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = FAQService(db)
    return await service.list_faqs(
        current_user,
        page=page,
        page_size=page_size,
        spu_id=spu_id,
        question_type=question_type,
        keyword=keyword,
    )


@router.get("/{faq_id}", response_model=FAQDetail)
async def get_faq(
    faq_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = FAQService(db)
    return await service.get_faq(faq_id, current_user)


@router.patch("/{faq_id}", response_model=FAQDetail)
async def update_faq(
    faq_id: int,
    data: FAQUpdate,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = FAQService(db)
    return await service.update_faq(faq_id, data, current_user)


@router.delete("/{faq_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faq(
    faq_id: int,
    current_user: User = Depends(require_product_or_admin),
    db: AsyncSession = Depends(get_db),
):
    service = FAQService(db)
    await service.delete_faq(faq_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
