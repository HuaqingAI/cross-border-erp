from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_admin
from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User, UserRole
from app.schemas.enums import EnumCreate, EnumGroupSummary, EnumItem, EnumUpdate
from app.services.enums import EnumService

router = APIRouter(prefix="/enums", tags=["Enums"])


@router.get("/groups", response_model=list[EnumGroupSummary])
async def list_enum_groups(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    del current_user
    service = EnumService(db)
    return await service.list_groups()


@router.get("", response_model=list[EnumItem])
async def list_enums(
    enum_group: str = Query(..., alias="group"),
    include_disabled: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    include_disabled = include_disabled and current_user.role == UserRole.ADMIN
    service = EnumService(db)
    return await service.list_enums(enum_group, include_disabled=include_disabled)


@router.post("", response_model=EnumItem, status_code=status.HTTP_201_CREATED)
async def create_enum(
    data: EnumCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    del current_user
    service = EnumService(db)
    return await service.create_enum(data)


@router.patch("/{enum_id}", response_model=EnumItem)
async def update_enum(
    enum_id: int,
    data: EnumUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    del current_user
    service = EnumService(db)
    return await service.update_enum(enum_id, data)


@router.delete("/{enum_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_enum(
    enum_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    del current_user
    service = EnumService(db)
    await service.delete_enum(enum_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
