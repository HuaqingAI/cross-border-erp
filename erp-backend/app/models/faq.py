from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel
from app.models.spu import SPU


class FAQ(BaseModel):
    __tablename__ = "faqs"

    spu_id: Mapped[int | None] = mapped_column(
        ForeignKey("spus.id"),
        nullable=True,
        index=True,
    )
    question_type: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    question: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    answer: Mapped[str] = mapped_column(String(200), nullable=False)
    attachment_object_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attachment_file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    attachment_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    spu: Mapped[SPU | None] = relationship("SPU")
