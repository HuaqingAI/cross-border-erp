from __future__ import annotations

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_import_permission
from app.db.session import get_db
from app.models.user import User
from app.schemas.import_tasks import (
    ImportConfirmRequest,
    ImportConfirmResponse,
    ImportTaskProgressResponse,
    ImportValidationResponse,
)
from app.services.import_tasks import EXCEL_CONTENT_TYPE, ImportTaskService

router = APIRouter(prefix="/import", tags=["数据导入"])


@router.get("/templates/{import_type}")
async def download_import_template(
    import_type: str,
    current_user: User = Depends(require_import_permission),
    db: AsyncSession = Depends(get_db),
):
    del current_user
    service = ImportTaskService(db)
    filename, content = await service.download_template(import_type)
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=content, media_type=EXCEL_CONTENT_TYPE, headers=headers)


@router.post("/{import_type}", response_model=ImportValidationResponse, status_code=status.HTTP_201_CREATED)
async def validate_import_file(
    import_type: str,
    file: UploadFile = File(...),
    current_user: User = Depends(require_import_permission),
    db: AsyncSession = Depends(get_db),
):
    del current_user
    service = ImportTaskService(db)
    return await service.validate_import_file(import_type, file)


@router.post("/{import_type}/confirm", response_model=ImportConfirmResponse)
async def confirm_import(
    import_type: str,
    data: ImportConfirmRequest,
    current_user: User = Depends(require_import_permission),
    db: AsyncSession = Depends(get_db),
):
    service = ImportTaskService(db)
    return await service.confirm_import(import_type, data.task_id, current_user)


@router.get("/tasks/{task_id}", response_model=ImportTaskProgressResponse)
async def get_import_task_progress(
    task_id: int,
    current_user: User = Depends(require_import_permission),
    db: AsyncSession = Depends(get_db),
):
    del current_user
    service = ImportTaskService(db)
    return await service.get_task_progress(task_id)
