from __future__ import annotations

from sqlalchemy import Boolean, Computed, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseModel


class SystemEnum(BaseModel):
    __tablename__ = "enums"
    __table_args__ = (
        Index(
            "ix_enums_active_group_key",
            "active_enum_group",
            "active_enum_key",
            unique=True,
        ),
    )

    enum_group: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    enum_key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    enum_value: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    active_enum_group: Mapped[str | None] = mapped_column(
        String(50),
        Computed("CASE WHEN deleted_at IS NULL THEN enum_group ELSE NULL END"),
        nullable=True,
    )
    active_enum_key: Mapped[str | None] = mapped_column(
        String(100),
        Computed("CASE WHEN deleted_at IS NULL THEN enum_key ELSE NULL END"),
        nullable=True,
    )
