from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import PaginatedResponse


class ProductDocumentOwnershipType(str, Enum):
    GENERAL = "通用"
    SKU = "指定SKU"
    CATEGORY = "按分类"


class ProductDocumentAttachmentInput(BaseModel):
    object_key: str = Field(min_length=1, max_length=255)
    file_url: str = Field(min_length=1, max_length=500)
    file_name: str = Field(min_length=1, max_length=255)
    sort_order: int | None = Field(default=None, ge=0)

    model_config = ConfigDict(extra="forbid")


def _normalize_required_text(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("资料名称不能为空")
    return normalized


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


class ProductDocumentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    document_type: str | None = Field(default=None, max_length=50)
    content_html: str | None = Field(default=None, max_length=20000)
    ownership_type: ProductDocumentOwnershipType
    sku_ids: list[int] = Field(default_factory=list)
    category_ids: list[int] = Field(default_factory=list)
    applicable_countries: list[str] = Field(default_factory=list)
    attachments: list[ProductDocumentAttachmentInput] = Field(default_factory=list)
    remarks: str | None = Field(default=None, max_length=1000)

    model_config = ConfigDict(extra="forbid")

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return _normalize_required_text(value)

    @field_validator("document_type", "remarks", mode="before")
    @classmethod
    def normalize_optional_fields(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)


class ProductDocumentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    document_type: str | None = Field(default=None, max_length=50)
    content_html: str | None = Field(default=None, max_length=20000)
    ownership_type: ProductDocumentOwnershipType | None = None
    sku_ids: list[int] | None = None
    category_ids: list[int] | None = None
    applicable_countries: list[str] | None = None
    attachments: list[ProductDocumentAttachmentInput] | None = None
    remarks: str | None = Field(default=None, max_length=1000)

    model_config = ConfigDict(extra="forbid")

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_required_text(value)

    @field_validator("document_type", "remarks", mode="before")
    @classmethod
    def normalize_optional_fields(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)


class ProductDocumentRelatedSKU(BaseModel):
    id: int
    sku_id: int
    sku_code: str
    sku_name_zh: str


class ProductDocumentRelatedCategory(BaseModel):
    id: int
    category_id: int
    category_code: str
    category_name: str
    level: int


class ProductDocumentAttachmentItem(BaseModel):
    id: int
    object_key: str
    file_url: str
    file_name: str
    sort_order: int


class ProductDocumentListItem(BaseModel):
    id: int
    name: str
    document_type: str | None = None
    ownership_type: ProductDocumentOwnershipType
    ownership_summary: str
    sku_ids: list[int]
    category_ids: list[int]
    applicable_countries: list[str]
    attachments: list[ProductDocumentAttachmentItem]
    created_at: datetime


class ProductDocumentListResponse(PaginatedResponse[ProductDocumentListItem]):
    pass


class ProductDocumentDetail(BaseModel):
    id: int
    name: str
    document_type: str | None = None
    content_html: str | None = None
    ownership_type: ProductDocumentOwnershipType
    ownership_summary: str
    sku_ids: list[int]
    category_ids: list[int]
    applicable_countries: list[str]
    skus: list[ProductDocumentRelatedSKU]
    categories: list[ProductDocumentRelatedCategory]
    attachments: list[ProductDocumentAttachmentItem]
    remarks: str | None = None
    created_at: datetime
    updated_at: datetime
