from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PaginatedResponse


class SKUProductType(str, Enum):
    MAIN_PRODUCT = "主品"
    ACCESSORY = "配件"
    CONSUMABLE = "耗材"


class SKUProductStatus(str, Enum):
    ACTIVE = "上架"
    INACTIVE_SELLABLE = "下架可售"
    INACTIVE_UNSELLABLE = "下架不可售"
    TEMPORARY = "临拓"


class SKUPackageDetailPayload(BaseModel):
    net_weight_kg: Decimal | None = Field(default=None, ge=0)
    gross_weight_kg: Decimal | None = Field(default=None, ge=0)
    length_cm: Decimal | None = Field(default=None, ge=0)
    width_cm: Decimal | None = Field(default=None, ge=0)
    height_cm: Decimal | None = Field(default=None, ge=0)
    volume_cbm: Decimal | None = Field(default=None, ge=0)
    sort_order: int | None = Field(default=None, ge=0)

    model_config = ConfigDict(extra="forbid")


class SKUCreate(BaseModel):
    spu_id: int = Field(gt=0)
    code: str = Field(min_length=1, max_length=50)
    name_zh: str = Field(min_length=1, max_length=100)
    name_en: str = Field(min_length=1, max_length=100)
    product_model: str = Field(min_length=1, max_length=100)
    product_type: SKUProductType
    core_params: str = Field(min_length=1, max_length=500)
    product_status: SKUProductStatus | None = None
    electrical_params: str | None = Field(default=None, max_length=100)
    principle: str = Field(min_length=1, max_length=500)
    usage: str = Field(min_length=1, max_length=500)
    material: str | None = Field(default=None, max_length=200)
    unit: str = Field(min_length=1, max_length=50)
    has_plug: bool
    is_special: bool
    special_notes: str | None = Field(default=None, max_length=1000)
    package_type: str | None = Field(default=None, max_length=50)
    package_quantity: int | None = Field(default=None, ge=0)
    package_details: list[SKUPackageDetailPayload] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class SKUUpdate(BaseModel):
    spu_id: int | None = Field(default=None, gt=0)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    name_zh: str | None = Field(default=None, min_length=1, max_length=100)
    name_en: str | None = Field(default=None, min_length=1, max_length=100)
    product_model: str | None = Field(default=None, min_length=1, max_length=100)
    product_type: SKUProductType | None = None
    core_params: str | None = Field(default=None, min_length=1, max_length=500)
    product_status: SKUProductStatus | None = None
    electrical_params: str | None = Field(default=None, max_length=100)
    principle: str | None = Field(default=None, min_length=1, max_length=500)
    usage: str | None = Field(default=None, min_length=1, max_length=500)
    material: str | None = Field(default=None, max_length=200)
    unit: str | None = Field(default=None, min_length=1, max_length=50)
    has_plug: bool | None = None
    is_special: bool | None = None
    special_notes: str | None = Field(default=None, max_length=1000)
    package_type: str | None = Field(default=None, max_length=50)
    package_quantity: int | None = Field(default=None, ge=0)
    package_details: list[SKUPackageDetailPayload] | None = None

    model_config = ConfigDict(extra="forbid")


class SKUCustomsInfoUpdate(BaseModel):
    customs_hscode: str | None = Field(default=None, max_length=50)
    customs_supervision_condition: str | None = Field(default=None, max_length=255)
    customs_declaration_elements: str | None = Field(default=None, max_length=1000)
    customs_refund_tax_rate: Decimal | None = Field(default=None, ge=0, le=100)
    customs_info_ready: bool | None = None

    model_config = ConfigDict(extra="forbid")


class SKUImageCreate(BaseModel):
    object_key: str = Field(min_length=1, max_length=255)
    file_url: str = Field(min_length=1, max_length=500)
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=100)
    sort_order: int | None = Field(default=None, ge=0)

    model_config = ConfigDict(extra="forbid")


class SKUPackageDetailResponse(BaseModel):
    id: int
    net_weight_kg: Decimal | None = None
    gross_weight_kg: Decimal | None = None
    length_cm: Decimal | None = None
    width_cm: Decimal | None = None
    height_cm: Decimal | None = None
    volume_cbm: Decimal | None = None
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class SKUImageResponse(BaseModel):
    id: int
    object_key: str
    file_url: str
    filename: str
    content_type: str
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class SKUListItem(BaseModel):
    id: int
    spu_id: int
    spu_code: str
    spu_name: str
    code: str
    name_zh: str
    name_en: str
    product_model: str
    product_type: SKUProductType
    level1_category_id: int
    level2_category_id: int
    level3_category_id: int
    supplier_name: str
    product_status: SKUProductStatus
    customer_warranty_months: int
    created_at: datetime


class SKUListResponse(PaginatedResponse[SKUListItem]):
    pass


class SKUDetail(BaseModel):
    id: int
    spu_id: int
    spu_code: str
    spu_name: str
    code: str
    name_zh: str
    name_en: str
    product_model: str
    product_type: SKUProductType
    level1_category_id: int
    level2_category_id: int
    level3_category_id: int
    supplier_name: str
    restricted_countries: list[str]
    customer_warranty_months: int
    core_params: str
    product_status: SKUProductStatus
    electrical_params: str | None = None
    principle: str
    usage: str
    material: str | None = None
    unit: str
    has_plug: bool
    is_special: bool
    special_notes: str | None = None
    package_type: str | None = None
    package_quantity: int | None = None
    package_details: list[SKUPackageDetailResponse]
    images: list[SKUImageResponse] = Field(default_factory=list)
    customs_hscode: str | None = None
    customs_supervision_condition: str | None = None
    customs_declaration_elements: str | None = None
    customs_refund_tax_rate: Decimal | None = None
    customs_info_ready: bool
    created_at: datetime
    updated_at: datetime
