from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ImportValidationErrorItem(BaseModel):
    row_number: int = Field(ge=2)
    field: str
    message: str
    row_key: str | None = None


class ImportValidationResponse(BaseModel):
    task_id: int
    task_type: str
    status: str
    total_rows: int
    success_count: int
    failed_count: int
    progress_percent: int = Field(ge=0, le=100)
    can_confirm: bool
    errors: list[ImportValidationErrorItem] = Field(default_factory=list)


class ImportConfirmRequest(BaseModel):
    task_id: int = Field(gt=0)


class ImportConfirmResponse(BaseModel):
    task_id: int
    task_type: str
    status: str
    imported_count: int
    progress_percent: int = Field(ge=0, le=100)
    confirmed_at: datetime | None = None


class ImportTaskProgressResponse(BaseModel):
    id: int
    task_type: str
    status: str
    original_filename: str | None = None
    total_rows: int
    valid_rows: int
    invalid_rows: int
    progress_percent: int = Field(ge=0, le=100)
    validation_errors: list[ImportValidationErrorItem] = Field(default_factory=list)
    result_summary: dict | None = None
    expires_at: datetime | None = None
    confirmed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
