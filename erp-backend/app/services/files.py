from __future__ import annotations

from app.core.storage import create_presigned_upload
from app.schemas.file import PresignedUrlRequest, PresignedUrlResponse


class FileService:
    async def create_presigned_url(self, data: PresignedUrlRequest) -> PresignedUrlResponse:
        upload_url, file_key, file_url = await create_presigned_upload(
            filename=data.filename,
            content_type=data.content_type,
            folder=data.folder,
        )
        return PresignedUrlResponse(
            upload_url=upload_url,
            file_key=file_key,
            file_url=file_url,
        )
