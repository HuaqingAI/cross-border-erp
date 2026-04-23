from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import PaginatedResponse


def _normalize_required_text(value: str, *, empty_message: str, too_long_message: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(empty_message)
    if len(normalized) > 200:
        raise ValueError(too_long_message)
    return normalized


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


class FAQCreate(BaseModel):
    spu_id: int | None = None
    question_type: str | None = Field(default=None, max_length=50)
    question: str
    answer: str
    attachment_object_key: str | None = Field(default=None, max_length=255)
    attachment_file_url: str | None = Field(default=None, max_length=500)
    attachment_file_name: str | None = Field(default=None, max_length=255)

    model_config = ConfigDict(extra="forbid")

    @field_validator("question", mode="before")
    @classmethod
    def normalize_question(cls, value: str) -> str:
        return _normalize_required_text(
            value,
            empty_message="问题不能为空",
            too_long_message="问题最大 200 字",
        )

    @field_validator("answer", mode="before")
    @classmethod
    def normalize_answer(cls, value: str) -> str:
        return _normalize_required_text(
            value,
            empty_message="答案不能为空",
            too_long_message="答案最大 200 字",
        )

    @field_validator("question_type", "attachment_object_key", "attachment_file_url", "attachment_file_name", mode="before")
    @classmethod
    def normalize_optional_fields(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)


class FAQUpdate(BaseModel):
    spu_id: int | None = None
    question_type: str | None = Field(default=None, max_length=50)
    question: str | None = None
    answer: str | None = None
    attachment_object_key: str | None = Field(default=None, max_length=255)
    attachment_file_url: str | None = Field(default=None, max_length=500)
    attachment_file_name: str | None = Field(default=None, max_length=255)

    model_config = ConfigDict(extra="forbid")

    @field_validator("question", mode="before")
    @classmethod
    def normalize_question(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_required_text(
            value,
            empty_message="问题不能为空",
            too_long_message="问题最大 200 字",
        )

    @field_validator("answer", mode="before")
    @classmethod
    def normalize_answer(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_required_text(
            value,
            empty_message="答案不能为空",
            too_long_message="答案最大 200 字",
        )

    @field_validator("question_type", "attachment_object_key", "attachment_file_url", "attachment_file_name", mode="before")
    @classmethod
    def normalize_optional_fields(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)


class FAQListItem(BaseModel):
    id: int
    spu_id: int | None = None
    question_type: str | None = None
    question: str
    answer: str
    scope_summary: str
    spu_code: str | None = None
    spu_name: str | None = None
    attachment_object_key: str | None = None
    attachment_file_url: str | None = None
    attachment_file_name: str | None = None
    created_at: datetime


class FAQListResponse(PaginatedResponse[FAQListItem]):
    pass


class FAQListQuery(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    spu_id: int | None = Field(default=None, gt=0)
    question_type: str | None = None
    keyword: str | None = None
    aggregate_spu_id: int | None = Field(default=None, gt=0)


class FAQDetail(BaseModel):
    id: int
    spu_id: int | None = None
    question_type: str | None = None
    question: str
    answer: str
    scope_summary: str
    spu_code: str | None = None
    spu_name: str | None = None
    attachment_object_key: str | None = None
    attachment_file_url: str | None = None
    attachment_file_name: str | None = None
    created_at: datetime
    updated_at: datetime
