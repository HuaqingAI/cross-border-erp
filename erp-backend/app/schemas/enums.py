from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _normalize_required_text(value: str, *, message: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(message)
    return normalized


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


class EnumGroupSummary(BaseModel):
    key: str
    label: str
    description: str
    total_count: int
    enabled_count: int


class EnumCreate(BaseModel):
    enum_group: str = Field(min_length=1, max_length=50)
    enum_key: str = Field(min_length=1, max_length=100)
    enum_value: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    sort_order: int = Field(default=0, ge=0)
    is_enabled: bool = True

    model_config = ConfigDict(extra="forbid")

    @field_validator("enum_group", mode="before")
    @classmethod
    def normalize_group(cls, value: str) -> str:
        return _normalize_required_text(value, message="枚举组不能为空")

    @field_validator("enum_key", mode="before")
    @classmethod
    def normalize_key(cls, value: str) -> str:
        return _normalize_required_text(value, message="枚举编码不能为空")

    @field_validator("enum_value", mode="before")
    @classmethod
    def normalize_value(cls, value: str) -> str:
        return _normalize_required_text(value, message="枚举显示值不能为空")

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)


class EnumUpdate(BaseModel):
    enum_key: str | None = Field(default=None, min_length=1, max_length=100)
    enum_value: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    sort_order: int | None = Field(default=None, ge=0)
    is_enabled: bool | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("enum_key", "enum_value", mode="before")
    @classmethod
    def normalize_required_update_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("枚举字段不能为空")
        return normalized

    @field_validator("description", mode="before")
    @classmethod
    def normalize_update_description(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)


class EnumItem(BaseModel):
    id: int
    enum_group: str
    enum_key: str
    enum_value: str
    description: str | None = None
    sort_order: int
    is_enabled: bool
    is_protected: bool
    created_at: datetime
    updated_at: datetime

