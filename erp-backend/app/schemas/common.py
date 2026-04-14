from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class ErrorDetail(BaseModel):
    field: str | None = None
    msg: str


class ErrorResponse(BaseModel):
    code: str       # 大写下划线: VALIDATION_ERROR, NOT_FOUND, FORBIDDEN, BUSINESS_ERROR
    message: str    # 中文，面向用户
    details: list[ErrorDetail] | None = None
