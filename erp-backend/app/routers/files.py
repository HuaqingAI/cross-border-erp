from fastapi import APIRouter, Depends, Query, Response, status

from app.core.permissions import require_product_or_admin
from app.models.user import User
from app.schemas.file import PresignedUrlRequest, PresignedUrlResponse
from app.services.files import FileService

router = APIRouter(prefix="/files", tags=["Files"])


@router.post("/presigned-url", response_model=PresignedUrlResponse, status_code=status.HTTP_201_CREATED)
async def create_presigned_url(
    data: PresignedUrlRequest,
    current_user: User = Depends(require_product_or_admin),
):
    del current_user
    service = FileService()
    return await service.create_presigned_url(data)


@router.delete("/object", status_code=status.HTTP_204_NO_CONTENT)
async def delete_object(
    object_key: str = Query(..., min_length=1),
    current_user: User = Depends(require_product_or_admin),
):
    del current_user
    service = FileService()
    await service.delete_object(object_key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
