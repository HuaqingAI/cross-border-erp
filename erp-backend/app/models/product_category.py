from __future__ import annotations

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel


class ProductCategory(BaseModel):
    __tablename__ = "product_categories"
    __table_args__ = (
        CheckConstraint("level IN (1, 2, 3)", name="ck_product_categories_level"),
    )

    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    level: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_categories.id"),
        nullable=True,
        index=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)

    parent: Mapped[ProductCategory | None] = relationship(
        "ProductCategory",
        remote_side="ProductCategory.id",
        back_populates="children",
    )
    children: Mapped[list[ProductCategory]] = relationship(
        "ProductCategory",
        back_populates="parent",
    )
