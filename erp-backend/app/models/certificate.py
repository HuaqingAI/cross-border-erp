from __future__ import annotations

from datetime import date

from sqlalchemy import Date, ForeignKey, String, and_
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel
from app.models.product_category import ProductCategory
from app.models.spu import SPU


class Certificate(BaseModel):
    __tablename__ = "certificates"

    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    certificate_no: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )
    certificate_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    issuing_authority: Mapped[str] = mapped_column(String(100), nullable=False)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    ownership_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    file_object_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    remarks: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    spu_assignments: Mapped[list[CertificateSPUAssignment]] = relationship(
        "CertificateSPUAssignment",
        primaryjoin=lambda: and_(
            Certificate.id == CertificateSPUAssignment.certificate_id,
            CertificateSPUAssignment.deleted_at.is_(None),
        ),
        order_by=lambda: CertificateSPUAssignment.id,
        back_populates="certificate",
    )
    category_assignments: Mapped[list[CertificateCategoryAssignment]] = relationship(
        "CertificateCategoryAssignment",
        primaryjoin=lambda: and_(
            Certificate.id == CertificateCategoryAssignment.certificate_id,
            CertificateCategoryAssignment.deleted_at.is_(None),
        ),
        order_by=lambda: CertificateCategoryAssignment.id,
        back_populates="certificate",
    )


class CertificateSPUAssignment(BaseModel):
    __tablename__ = "certificate_spu_assignments"

    certificate_id: Mapped[int] = mapped_column(
        ForeignKey("certificates.id"),
        nullable=False,
        index=True,
    )
    spu_id: Mapped[int] = mapped_column(ForeignKey("spus.id"), nullable=False, index=True)

    certificate: Mapped[Certificate] = relationship(
        "Certificate",
        back_populates="spu_assignments",
    )
    spu: Mapped[SPU] = relationship("SPU")


class CertificateCategoryAssignment(BaseModel):
    __tablename__ = "certificate_category_assignments"

    certificate_id: Mapped[int] = mapped_column(
        ForeignKey("certificates.id"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("product_categories.id"),
        nullable=False,
        index=True,
    )

    certificate: Mapped[Certificate] = relationship(
        "Certificate",
        back_populates="category_assignments",
    )
    category: Mapped[ProductCategory] = relationship("ProductCategory")
