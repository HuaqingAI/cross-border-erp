from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class PresignedUrlRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=100)
    folder: str = Field(default="sku-images", min_length=1, max_length=100)

    model_config = ConfigDict(extra="forbid")


class PresignedUrlResponse(BaseModel):
    upload_url: str
    file_key: str
    file_url: str
