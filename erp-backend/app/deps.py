from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.auth import AuthService


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """从 Cookie 中解析 access_token，返回当前用户。未登录抛 401。"""
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="未登录")
    service = AuthService(db)
    return await service.get_user_by_token(access_token)


__all__ = ["get_db", "get_current_user"]
