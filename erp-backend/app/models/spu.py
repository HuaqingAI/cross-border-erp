from __future__ import annotations

from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, and_
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import BaseModel


class SPU(BaseModel):
    __tablename__ = "spus"

    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
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
    customer_warranty_months: Mapped[int] = mapped_column(nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    restricted_countries: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    supplier_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    manufacturer_model: Mapped[str] = mapped_column(String(100), nullable=False)
    purchase_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    purchase_warranty_months: Mapped[int | None] = mapped_column(nullable=True)
    supplier_warranty_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    invoice_infos: Mapped[list[SPUInvoiceInfo]] = relationship(
        "SPUInvoiceInfo",
        primaryjoin=lambda: and_(
            SPU.id == SPUInvoiceInfo.spu_id,
            SPUInvoiceInfo.deleted_at.is_(None),
        ),
        order_by=lambda: (SPUInvoiceInfo.sort_order, SPUInvoiceInfo.id),
        back_populates="spu",
    )


class SPUInvoiceInfo(BaseModel):
    __tablename__ = "spu_invoice_infos"

    spu_id: Mapped[int] = mapped_column(
        ForeignKey("spus.id"),
        nullable=False,
        index=True,
    )
    invoice_name: Mapped[str] = mapped_column(String(100), nullable=False)
    invoice_unit: Mapped[str] = mapped_column(String(50), nullable=False)
    invoice_model: Mapped[str] = mapped_column(String(100), nullable=False)
    company_subject: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(nullable=False, default=0, index=True)

    spu: Mapped[SPU] = relationship("SPU", back_populates="invoice_infos")
