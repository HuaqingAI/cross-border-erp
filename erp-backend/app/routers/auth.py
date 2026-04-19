from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, UserResponse
from app.services.auth import AuthService
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["认证"])

ACCESS_MAX_AGE = 30 * 60        # 30 分钟（秒）
REFRESH_MAX_AGE = 7 * 24 * 3600  # 7 天（秒）


def _cookie_opts() -> dict[str, object]:
    return {
        "httponly": True,
        "samesite": settings.COOKIE_SAMESITE,
        "secure": settings.COOKIE_SECURE,
    }


@router.post("/login", response_model=LoginResponse)
async def login(
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    user, access_token, refresh_token = await service.login(data)

    response.set_cookie(
        "access_token", access_token, max_age=ACCESS_MAX_AGE, **_cookie_opts()
    )
    response.set_cookie(
        "refresh_token", refresh_token, max_age=REFRESH_MAX_AGE, **_cookie_opts()
    )
    return LoginResponse(user=UserResponse.model_validate(user))


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "已登出"}


@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="缺少 refresh token")

    service = AuthService(db)
    access_token = await service.refresh(refresh_token)
    response.set_cookie(
        "access_token", access_token, max_age=ACCESS_MAX_AGE, **_cookie_opts()
    )
    return {"message": "token 已刷新"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
