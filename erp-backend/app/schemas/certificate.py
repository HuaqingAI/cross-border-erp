from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PaginatedResponse


class CertificateOwnershipType(str, Enum):
    GENERAL = "通用"
    SPU = "SPU归属"
    CATEGORY = "按分类"


class CertificateValidityStatus(str, Enum):
    VALID = "有效"
    EXPIRING = "即将过期"
    EXPIRED = "已过期"


class CertificateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    certificate_no: str = Field(min_length=1, max_length=100)
    certificate_type: str = Field(min_length=1, max_length=50)
    issuing_authority: str = Field(min_length=1, max_length=100)
    valid_from: date
    valid_to: date
    ownership_type: CertificateOwnershipType
    spu_ids: list[int] = Field(default_factory=list)
    category_ids: list[int] = Field(default_factory=list)
    file_object_key: str | None = Field(default=None, max_length=255)
    file_url: str | None = Field(default=None, max_length=500)
    file_name: str | None = Field(default=None, max_length=255)
    remarks: str | None = Field(default=None, max_length=1000)

    model_config = ConfigDict(extra="forbid")


class CertificateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    certificate_no: str | None = Field(default=None, min_length=1, max_length=100)
    certificate_type: str | None = Field(default=None, min_length=1, max_length=50)
    issuing_authority: str | None = Field(default=None, min_length=1, max_length=100)
    valid_from: date | None = None
    valid_to: date | None = None
    ownership_type: CertificateOwnershipType | None = None
    spu_ids: list[int] | None = None
    category_ids: list[int] | None = None
    file_object_key: str | None = Field(default=None, max_length=255)
    file_url: str | None = Field(default=None, max_length=500)
    file_name: str | None = Field(default=None, max_length=255)
    remarks: str | None = Field(default=None, max_length=1000)

    model_config = ConfigDict(extra="forbid")


class CertificateRelatedSPU(BaseModel):
    id: int
    spu_id: int
    spu_code: str
    spu_name: str


class CertificateRelatedCategory(BaseModel):
    id: int
    category_id: int
    category_code: str
    category_name: str
    level: int


class CertificateListItem(BaseModel):
    id: int
    name: str
    certificate_no: str
    certificate_type: str
    issuing_authority: str
    valid_from: date
    valid_to: date
    ownership_type: CertificateOwnershipType
    ownership_summary: str
    validity_status: CertificateValidityStatus
    spu_ids: list[int]
    category_ids: list[int]
    created_at: datetime


class CertificateListResponse(PaginatedResponse[CertificateListItem]):
    pass


class CertificateDetail(BaseModel):
    id: int
    name: str
    certificate_no: str
    certificate_type: str
    issuing_authority: str
    valid_from: date
    valid_to: date
    ownership_type: CertificateOwnershipType
    ownership_summary: str
    validity_status: CertificateValidityStatus
    spu_ids: list[int]
    category_ids: list[int]
    spus: list[CertificateRelatedSPU]
    categories: list[CertificateRelatedCategory]
    file_object_key: str | None = None
    file_url: str | None = None
    file_name: str | None = None
    remarks: str | None = None
    created_at: datetime
    updated_at: datetime
