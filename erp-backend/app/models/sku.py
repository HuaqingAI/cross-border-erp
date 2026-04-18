from __future__ import annotations

from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric, String, and_
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import BaseModel
from app.models.spu import SPU


class SKU(BaseModel):
    __tablename__ = "skus"

    spu_id: Mapped[int] = mapped_column(ForeignKey("spus.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name_zh: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name_en: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    product_model: Mapped[str] = mapped_column(String(100), nullable=False)
    product_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    level1_category_id: Mapped[int] = mapped_column(
        ForeignKey("product_categories.id"),
        nullable=False,
        index=True,
    )
    level2_category_id: Mapped[int] = mapped_column(
        ForeignKey("product_categories.id"),
        nullable=False,
        index=True,
    )
    level3_category_id: Mapped[int] = mapped_column(
        ForeignKey("product_categories.id"),
        nullable=False,
        index=True,
    )
    supplier_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    restricted_countries: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    customer_warranty_months: Mapped[int] = mapped_column(nullable=False)
    core_params: Mapped[str] = mapped_column(String(500), nullable=False)
    product_status: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    electrical_params: Mapped[str | None] = mapped_column(String(100), nullable=True)
    principle: Mapped[str] = mapped_column(String(500), nullable=False)
    usage: Mapped[str] = mapped_column(String(500), nullable=False)
    material: Mapped[str | None] = mapped_column(String(200), nullable=True)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    has_plug: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_special: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    special_notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    package_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    package_quantity: Mapped[int | None] = mapped_column(nullable=True)
    customs_hscode: Mapped[str | None] = mapped_column(String(50), nullable=True)
    customs_supervision_condition: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    customs_declaration_elements: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )
    customs_refund_tax_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    customs_info_ready: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    spu: Mapped[SPU] = relationship("SPU")
    package_details: Mapped[list[SKUPackageDetail]] = relationship(
        "SKUPackageDetail",
        primaryjoin=lambda: and_(
            SKU.id == SKUPackageDetail.sku_id,
            SKUPackageDetail.deleted_at.is_(None),
        ),
        order_by=lambda: (SKUPackageDetail.sort_order, SKUPackageDetail.id),
        back_populates="sku",
    )
    images: Mapped[list[SKUImage]] = relationship(
        "SKUImage",
        primaryjoin=lambda: and_(
            SKU.id == SKUImage.sku_id,
            SKUImage.deleted_at.is_(None),
        ),
        order_by=lambda: (SKUImage.sort_order, SKUImage.id),
        back_populates="sku",
    )


class SKUPackageDetail(BaseModel):
    __tablename__ = "sku_package_details"

    sku_id: Mapped[int] = mapped_column(ForeignKey("skus.id"), nullable=False, index=True)
    net_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(10, 3), nullable=True)
    gross_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(10, 3), nullable=True)
    length_cm: Mapped[Decimal | None] = mapped_column(Numeric(10, 3), nullable=True)
    width_cm: Mapped[Decimal | None] = mapped_column(Numeric(10, 3), nullable=True)
    height_cm: Mapped[Decimal | None] = mapped_column(Numeric(10, 3), nullable=True)
    volume_cbm: Mapped[Decimal | None] = mapped_column(Numeric(10, 3), nullable=True)
    sort_order: Mapped[int] = mapped_column(nullable=False, default=0, index=True)

    sku: Mapped[SKU] = relationship("SKU", back_populates="package_details")


class SKUImage(BaseModel):
    __tablename__ = "sku_images"

    sku_id: Mapped[int] = mapped_column(ForeignKey("skus.id"), nullable=False, index=True)
    object_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(nullable=False, default=0, index=True)

    sku: Mapped[SKU] = relationship("SKU", back_populates="images")
