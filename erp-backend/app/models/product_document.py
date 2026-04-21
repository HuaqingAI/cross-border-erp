from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text, and_
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import BaseModel
from app.models.product_category import ProductCategory
from app.models.sku import SKU


class ProductDocument(BaseModel):
    __tablename__ = "product_documents"

    content_html_type = Text().with_variant(mysql.LONGTEXT(), "mysql")

    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    document_type: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    content_html: Mapped[str | None] = mapped_column(content_html_type, nullable=True)
    ownership_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    applicable_countries: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    remarks: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    sku_assignments: Mapped[list[ProductDocumentSKUAssignment]] = relationship(
        "ProductDocumentSKUAssignment",
        primaryjoin=lambda: and_(
            ProductDocument.id == ProductDocumentSKUAssignment.product_document_id,
            ProductDocumentSKUAssignment.deleted_at.is_(None),
        ),
        order_by=lambda: ProductDocumentSKUAssignment.id,
        back_populates="product_document",
    )
    category_assignments: Mapped[list[ProductDocumentCategoryAssignment]] = relationship(
        "ProductDocumentCategoryAssignment",
        primaryjoin=lambda: and_(
            ProductDocument.id == ProductDocumentCategoryAssignment.product_document_id,
            ProductDocumentCategoryAssignment.deleted_at.is_(None),
        ),
        order_by=lambda: ProductDocumentCategoryAssignment.id,
        back_populates="product_document",
    )
    attachments: Mapped[list[ProductDocumentAttachment]] = relationship(
        "ProductDocumentAttachment",
        primaryjoin=lambda: and_(
            ProductDocument.id == ProductDocumentAttachment.product_document_id,
            ProductDocumentAttachment.deleted_at.is_(None),
        ),
        order_by=lambda: (
            ProductDocumentAttachment.sort_order,
            ProductDocumentAttachment.id,
        ),
        back_populates="product_document",
    )


class ProductDocumentSKUAssignment(BaseModel):
    __tablename__ = "product_document_sku_assignments"

    product_document_id: Mapped[int] = mapped_column(
        ForeignKey("product_documents.id"),
        nullable=False,
        index=True,
    )
    sku_id: Mapped[int] = mapped_column(ForeignKey("skus.id"), nullable=False, index=True)

    product_document: Mapped[ProductDocument] = relationship(
        "ProductDocument",
        back_populates="sku_assignments",
    )
    sku: Mapped[SKU] = relationship("SKU")


class ProductDocumentCategoryAssignment(BaseModel):
    __tablename__ = "product_document_category_assignments"

    product_document_id: Mapped[int] = mapped_column(
        ForeignKey("product_documents.id"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("product_categories.id"),
        nullable=False,
        index=True,
    )

    product_document: Mapped[ProductDocument] = relationship(
        "ProductDocument",
        back_populates="category_assignments",
    )
    category: Mapped[ProductCategory] = relationship("ProductCategory")


class ProductDocumentAttachment(BaseModel):
    __tablename__ = "product_document_attachments"

    product_document_id: Mapped[int] = mapped_column(
        ForeignKey("product_documents.id"),
        nullable=False,
        index=True,
    )
    object_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(nullable=False, default=0, index=True)

    product_document: Mapped[ProductDocument] = relationship(
        "ProductDocument",
        back_populates="attachments",
    )
