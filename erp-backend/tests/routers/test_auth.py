"""
认证 API 测试 — 8 个场景全覆盖。
"""

import pytest
from httpx import AsyncClient

from app.models.user import User


def _find_set_cookie(response, cookie_name: str) -> str:
    for header in response.headers.get_list("set-cookie"):
        if header.startswith(f"{cookie_name}="):
            return header
    raise AssertionError(f"未找到 {cookie_name} 的 Set-Cookie 头")


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_user: User):
    """正确凭证 → 200 + 用户信息 + Cookie 已设置。"""
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "TestPass123!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["username"] == "testuser"
    assert data["user"]["role"] == "product_dept"
    assert "id" in data["user"]
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies
    assert "Max-Age=21600" in _find_set_cookie(response, "access_token")
    assert "Max-Age=604800" in _find_set_cookie(response, "refresh_token")


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, test_user: User):
    """错误密码 → 401。"""
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "WrongPassword!"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_wrong_username(client: AsyncClient, test_user: User):
    """不存在的用户名 → 401。"""
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "nonexistent", "password": "TestPass123!"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_logout(client: AsyncClient, test_user: User):
    """登录后登出 → 200，Cookie 清除。"""
    # 先登录
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "TestPass123!"},
    )
    assert login_resp.status_code == 200

    # 再登出
    logout_resp = await client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 200
    # Cookie 应被清除（max-age=0 或 Set-Cookie: name=; expires=past）
    set_cookie_headers = logout_resp.headers.get_list("set-cookie")
    cookie_names = [h.split("=")[0].strip() for h in set_cookie_headers]
    assert "access_token" in cookie_names
    assert "refresh_token" in cookie_names


@pytest.mark.asyncio
async def test_protected_endpoint_no_cookie(client: AsyncClient):
    """无 Cookie 访问 /auth/me → 401。"""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_with_cookie(client: AsyncClient, test_user: User):
    """有效 Cookie 访问 /auth/me → 200 + 返回当前用户。"""
    # 先登录获取 Cookie
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "TestPass123!"},
    )
    assert login_resp.status_code == 200
    access_token = login_resp.cookies["access_token"]

    # 携带 Cookie 访问 me
    client.cookies.set("access_token", access_token)
    me_resp = await client.get("/api/v1/auth/me")
    assert me_resp.status_code == 200
    data = me_resp.json()
    assert data["username"] == "testuser"
    assert data["role"] == "product_dept"


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient, test_user: User):
    """有效 refresh_token → 200 + 返回新 access_token Cookie。"""
    # 先登录
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "TestPass123!"},
    )
    assert login_resp.status_code == 200
    refresh_token = login_resp.cookies["refresh_token"]

    # 使用 refresh_token 刷新
    client.cookies.set("refresh_token", refresh_token)
    refresh_resp = await client.post("/api/v1/auth/refresh")
    assert refresh_resp.status_code == 200
    assert "access_token" in refresh_resp.cookies
    assert "Max-Age=21600" in _find_set_cookie(refresh_resp, "access_token")


@pytest.mark.asyncio
async def test_refresh_invalid_token(client: AsyncClient):
    """无效 refresh_token → 401。"""
    client.cookies.set("refresh_token", "invalid.token.value")
    refresh_resp = await client.post("/api/v1/auth/refresh")
    assert refresh_resp.status_code == 401
