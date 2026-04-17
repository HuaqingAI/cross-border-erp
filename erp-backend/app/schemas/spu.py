from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PaginatedResponse


class SPUInvoiceInfoPayload(BaseModel):
    invoice_name: str = Field(min_length=1, max_length=100)
    invoice_unit: str = Field(min_length=1, max_length=50)
    invoice_model: str = Field(min_length=1, max_length=100)
    company_subject: str = Field(min_length=1, max_length=100)
    sort_order: int = Field(default=0, ge=0)


class SPUCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    level1_category_id: int = Field(gt=0)
    level2_category_id: int = Field(gt=0)
    level3_category_id: int = Field(gt=0)
    customer_warranty_months: int = Field(ge=0)
    unit: str = Field(min_length=1, max_length=50)
    restricted_countries: list[str] = Field(default_factory=list)
    supplier_name: str = Field(min_length=1, max_length=100)
    manufacturer_model: str = Field(min_length=1, max_length=100)
    purchase_price: Decimal | None = Field(default=None, ge=0)
    purchase_warranty_months: int | None = Field(default=None, ge=0)
    supplier_warranty_notes: str | None = Field(default=None, max_length=500)
    invoice_infos: list[SPUInvoiceInfoPayload]


class SPUUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    level1_category_id: int | None = Field(default=None, gt=0)
    level2_category_id: int | None = Field(default=None, gt=0)
    level3_category_id: int | None = Field(default=None, gt=0)
    customer_warranty_months: int | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, min_length=1, max_length=50)
    restricted_countries: list[str] | None = None
    supplier_name: str | None = Field(default=None, min_length=1, max_length=100)
    manufacturer_model: str | None = Field(default=None, min_length=1, max_length=100)
    purchase_price: Decimal | None = Field(default=None, ge=0)
    purchase_warranty_months: int | None = Field(default=None, ge=0)
    supplier_warranty_notes: str | None = Field(default=None, max_length=500)
    invoice_infos: list[SPUInvoiceInfoPayload] | None = None


class SPUInvoiceInfoResponse(BaseModel):
    id: int
    invoice_name: str
    invoice_unit: str
    invoice_model: str
    company_subject: str
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class SPUListItemBase(BaseModel):
    id: int
    code: str
    name: str
    level1_category_id: int
    level2_category_id: int
    level3_category_id: int
    supplier_name: str
    customer_warranty_months: int
    unit: str
    manufacturer_model: str
    created_at: datetime


class SPUListItemPublic(SPUListItemBase):
    pass


class SPUListItemFull(SPUListItemBase):
    purchase_price: Decimal | None = None


class SPUListResponsePublic(PaginatedResponse[SPUListItemPublic]):
    pass


class SPUListResponseFull(PaginatedResponse[SPUListItemFull]):
    pass


class SPUDetailBase(BaseModel):
    id: int
    code: str
    name: str
    level1_category_id: int
    level2_category_id: int
    level3_category_id: int
    customer_warranty_months: int
    unit: str
    restricted_countries: list[str]
    supplier_name: str
    manufacturer_model: str
    purchase_warranty_months: int | None = None
    supplier_warranty_notes: str | None = None
    invoice_infos: list[SPUInvoiceInfoResponse]
    created_at: datetime
    updated_at: datetime


class SPUDetailPublic(SPUDetailBase):
    pass


class SPUDetailFull(SPUDetailBase):
    purchase_price: Decimal | None = None
