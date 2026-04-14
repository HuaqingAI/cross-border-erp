from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db


async def get_current_user():
    """
    当前用户依赖注入占位。
    Story 1.2 将实现 JWT 解析和用户验证。
    Story 1.3 将在此基础上添加权限检查。
    """
    raise NotImplementedError("Story 1.2 将实现此方法")


# Re-export get_db for convenience
__all__ = ["get_db", "get_current_user"]
