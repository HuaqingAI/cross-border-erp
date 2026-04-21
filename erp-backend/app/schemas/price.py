from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import PaginatedResponse


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _normalize_required_code(
    value: str,
    *,
    empty_message: str,
) -> str:
    normalized = value.strip().upper()
    if not normalized:
        raise ValueError(empty_message)
    return normalized


class PriceRegionPayload(BaseModel):
    country_code: str | None = Field(default=None, max_length=20)
    country_name: str | None = Field(default=None, max_length=100)
    currency: str
    sale_price: Decimal = Field(ge=0)
    list_price: Decimal = Field(ge=0)
    remarks: str | None = Field(default=None, max_length=500)
    sort_order: int | None = Field(default=None, ge=0)

    model_config = ConfigDict(extra="forbid")

    @field_validator("country_code", mode="before")
    @classmethod
    def normalize_country_code(cls, value: str | None) -> str | None:
        normalized = _normalize_optional_text(value)
        return normalized.upper() if normalized is not None else None

    @field_validator("country_name", "remarks", mode="before")
    @classmethod
    def normalize_optional_fields(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return _normalize_required_code(value, empty_message="币种不能为空")

    @model_validator(mode="after")
    def populate_global_region_defaults(self) -> PriceRegionPayload:
        if not self.country_code:
            self.country_code = "GLOBAL"
        if not self.country_name:
            self.country_name = "全球" if self.country_code == "GLOBAL" else self.country_code
        return self


class PriceCreate(BaseModel):
    sku_id: int = Field(gt=0)
    regions: list[PriceRegionPayload] = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")


class PriceUpdate(BaseModel):
    sku_id: int | None = Field(default=None, gt=0)
    regions: list[PriceRegionPayload] | None = Field(default=None, min_length=1)

    model_config = ConfigDict(extra="forbid")


class PriceRegionResponse(BaseModel):
    id: int
    country_code: str
    country_name: str
    currency: str
    sale_price: Decimal
    list_price: Decimal
    remarks: str | None = None
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class PriceListItem(BaseModel):
    id: int
    sku_id: int
    sku_code: str
    sku_name_zh: str
    sku_name_en: str
    spu_id: int
    spu_code: str
    spu_name: str
    level1_category_id: int
    level1_category_code: str
    level1_category_name: str
    level2_category_id: int
    level2_category_code: str
    level2_category_name: str
    level3_category_id: int
    level3_category_code: str
    level3_category_name: str
    purchase_price: Decimal | None = None
    supplier_name: str
    product_model: str
    product_status: str
    region_summary: str
    updated_at: datetime
    created_at: datetime


class PriceListResponse(PaginatedResponse[PriceListItem]):
    pass


class PriceDetail(BaseModel):
    id: int
    sku_id: int
    sku_code: str
    sku_name_zh: str
    sku_name_en: str
    spu_id: int
    spu_code: str
    spu_name: str
    level1_category_id: int
    level1_category_code: str
    level1_category_name: str
    level2_category_id: int
    level2_category_code: str
    level2_category_name: str
    level3_category_id: int
    level3_category_code: str
    level3_category_name: str
    purchase_price: Decimal | None = None
    supplier_name: str
    product_model: str
    product_status: str
    region_summary: str
    regions: list[PriceRegionResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
