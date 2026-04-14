from enum import Enum as PyEnum

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseModel


class UserRole(str, PyEnum):
    ADMIN = "admin"
    PRODUCT_DEPT = "product_dept"
    BUSINESS_DEPT = "business_dept"
    FINANCE_DEPT = "finance_dept"


class User(BaseModel):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), nullable=False, default=UserRole.PRODUCT_DEPT
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
