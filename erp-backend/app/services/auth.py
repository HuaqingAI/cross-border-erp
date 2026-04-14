from fastapi import HTTPException
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
    verify_token,
)
from app.models.user import User
from app.repositories.users import UserRepository
from app.schemas.auth import LoginRequest


class AuthService:
    def __init__(self, db: AsyncSession):
        self.user_repo = UserRepository(db)

    async def login(self, data: LoginRequest) -> tuple[User, str, str]:
        """验证凭证，返回 (user, access_token, refresh_token)。"""
        user = await self.user_repo.get_by_username(data.username)
        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(status_code=401, detail="用户名或密码错误")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="账号已被禁用")

        payload = {"sub": str(user.id)}
        access_token = create_access_token(payload)
        refresh_token = create_refresh_token(payload)
        return user, access_token, refresh_token

    async def refresh(self, refresh_token: str) -> str:
        """验证 refresh_token，返回新 access_token。"""
        try:
            payload = verify_token(refresh_token)
        except JWTError:
            raise HTTPException(status_code=401, detail="refresh token 无效或已过期")
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="token 类型错误")

        user = await self.user_repo.get_by_id(int(payload["sub"]))
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="用户不存在或已禁用")

        return create_access_token({"sub": str(user.id)})

    async def get_user_by_token(self, access_token: str) -> User:
        """解析 access_token，返回对应用户。"""
        try:
            payload = verify_token(access_token)
        except JWTError:
            raise HTTPException(status_code=401, detail="access token 无效或已过期")
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="token 类型错误")

        user = await self.user_repo.get_by_id(int(payload["sub"]))
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="用户不存在或已禁用")
        return user
