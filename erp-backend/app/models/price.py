from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Computed, DateTime, ForeignKey, Index, Integer, Numeric, String, and_
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel


class Price(BaseModel):
    __tablename__ = "prices"
    __table_args__ = (
        Index("ix_prices_active_sku_id", "active_sku_id", unique=True),
    )

    sku_id: Mapped[int] = mapped_column(ForeignKey("skus.id"), nullable=False, index=True)
    sku_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    sku_name_zh: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    sku_name_en: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    spu_id: Mapped[int] = mapped_column(ForeignKey("spus.id"), nullable=False, index=True)
    spu_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    spu_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    level1_category_id: Mapped[int] = mapped_column(
        ForeignKey("product_categories.id"),
        nullable=False,
        index=True,
    )
    level1_category_code: Mapped[str] = mapped_column(String(50), nullable=False)
    level1_category_name: Mapped[str] = mapped_column(String(100), nullable=False)
    level2_category_id: Mapped[int] = mapped_column(
        ForeignKey("product_categories.id"),
        nullable=False,
        index=True,
    )
    level2_category_code: Mapped[str] = mapped_column(String(50), nullable=False)
    level2_category_name: Mapped[str] = mapped_column(String(100), nullable=False)
    level3_category_id: Mapped[int] = mapped_column(
        ForeignKey("product_categories.id"),
        nullable=False,
        index=True,
    )
    level3_category_code: Mapped[str] = mapped_column(String(50), nullable=False)
    level3_category_name: Mapped[str] = mapped_column(String(100), nullable=False)
    purchase_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    supplier_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    product_model: Mapped[str] = mapped_column(String(100), nullable=False)
    product_status: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    approval_status: Mapped[str] = mapped_column(String(20), nullable=False, default="草稿", index=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    active_sku_id: Mapped[int | None] = mapped_column(
        Integer,
        Computed("CASE WHEN deleted_at IS NULL THEN sku_id ELSE NULL END"),
        nullable=True,
    )

    regions: Mapped[list[PriceRegion]] = relationship(
        "PriceRegion",
        primaryjoin=lambda: and_(
            Price.id == PriceRegion.price_id,
            PriceRegion.deleted_at.is_(None),
        ),
        order_by=lambda: (PriceRegion.sort_order, PriceRegion.id),
        back_populates="price",
    )


class PriceRegion(BaseModel):
    __tablename__ = "price_regions"
    __table_args__ = (
        Index(
            "ix_price_regions_price_id_version_stage_active_country_code",
            "price_id",
            "version_stage",
            "active_country_code",
            unique=True,
        ),
    )

    price_id: Mapped[int] = mapped_column(ForeignKey("prices.id"), nullable=False, index=True)
    version_stage: Mapped[str] = mapped_column(String(20), nullable=False, default="approved", index=True)
    country_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    country_name: Mapped[str] = mapped_column(String(100), nullable=False)
    currency: Mapped[str] = mapped_column(String(20), nullable=False)
    sale_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    list_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    remarks: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(nullable=False, default=0, index=True)
    active_country_code: Mapped[str | None] = mapped_column(
        String(20),
        Computed("CASE WHEN deleted_at IS NULL THEN country_code ELSE NULL END"),
        nullable=True,
    )

    price: Mapped[Price] = relationship("Price", back_populates="regions")
