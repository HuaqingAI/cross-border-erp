# 导入所有 SQLAlchemy Model，用于 Alembic 自动检测
from app.models.user import User  # noqa: F401

__all__ = ["User"]
