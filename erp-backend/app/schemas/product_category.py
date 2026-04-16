from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ProductCategoryCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    parent_id: int | None = None
    sort_order: int | None = Field(default=None, ge=0)


class ProductCategoryUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    sort_order: int | None = Field(default=None, ge=0)


class ProductCategorySortUpdate(BaseModel):
    sort_order: int = Field(ge=0)


class ProductCategoryResponse(BaseModel):
    id: int
    code: str
    name: str
    level: int
    parent_id: int | None
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class ProductCategoryTreeNode(ProductCategoryResponse):
    children: list["ProductCategoryTreeNode"] = Field(default_factory=list)


ProductCategoryTreeNode.model_rebuild()
