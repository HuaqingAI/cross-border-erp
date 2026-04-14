"""
RBAC 集成测试：验证 require_role() 依赖对不同角色的访问控制。

测试方案：在 app 上注册测试专用路由（通过 session fixture，测试结束后清理）。
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.permissions import (
    can_edit_customs_info,
    can_view_full_price,
    can_view_purchase_price,
    require_business_or_admin,
    require_finance_or_admin,
    require_product_or_admin,
)
from app.core.security import hash_password
from app.main import app
from app.models.user import User, UserRole


# ──────────────────────────────────────────────────────────────────────────────
# 测试专用路由定义
# ──────────────────────────────────────────────────────────────────────────────
from fastapi import APIRouter, Depends

_rbac_test_router = APIRouter(prefix="/api/v1/rbac-test", include_in_schema=False)


@_rbac_test_router.get("/product-write")
async def _product_write(current_user: User = Depends(require_product_or_admin)):
    return {"role": current_user.role, "allowed": True}


@_rbac_test_router.get("/business-write")
async def _business_write(current_user: User = Depends(require_business_or_admin)):
    return {"role": current_user.role, "allowed": True}


@_rbac_test_router.get("/finance-write")
async def _finance_write(current_user: User = Depends(require_finance_or_admin)):
    return {"role": current_user.role, "allowed": True}


@pytest.fixture(autouse=True, scope="session")
def _register_rbac_test_routes():
    """测试会话开始时注册测试路由，结束后清理，避免污染其他测试文件。"""
    app.include_router(_rbac_test_router)
    yield
    app.router.routes = [
        r for r in app.router.routes
        if not getattr(r, "path", "").startswith("/api/v1/rbac-test")
    ]
    app.openapi_schema = None  # 清除缓存的 OpenAPI schema


# ──────────────────────────────────────────────────────────────────────────────
# Fixtures：为每个测试角色创建用户并登录，返回已验证的 AsyncClient
# ──────────────────────────────────────────────────────────────────────────────

async def _create_user_and_login(db_session, client, username, role) -> AsyncClient:
    """辅助函数：创建用户 → 登录 → 返回携带 Cookie 的 client（共享同一实例）"""
    user = User(
        username=username,
        password_hash=hash_password("Test123!"),
        role=role,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    resp = await client.post("/api/v1/auth/login", json={"username": username, "password": "Test123!"})
    assert resp.status_code == 200, f"登录失败: {resp.text}"
    return client


# ──────────────────────────────────────────────────────────────────────────────
# 测试用例
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_product_dept_can_access_product_write(client, db_session):
    """产品部可访问产品写操作端点（200）"""
    await _create_user_and_login(db_session, client, "product1", UserRole.PRODUCT_DEPT)
    resp = await client.get("/api/v1/rbac-test/product-write")
    assert resp.status_code == 200
    assert resp.json()["allowed"] is True


@pytest.mark.asyncio
async def test_business_dept_cannot_access_product_write(client, db_session):
    """商务部无法访问产品写操作端点（403）"""
    await _create_user_and_login(db_session, client, "business1", UserRole.BUSINESS_DEPT)
    resp = await client.get("/api/v1/rbac-test/product-write")
    assert resp.status_code == 403
    assert "无权限" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_finance_dept_cannot_access_product_write(client, db_session):
    """财务部无法访问产品写操作端点（403）"""
    await _create_user_and_login(db_session, client, "finance1", UserRole.FINANCE_DEPT)
    resp = await client.get("/api/v1/rbac-test/product-write")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_access_product_write(client, db_session):
    """管理员可访问产品写操作端点（200）"""
    await _create_user_and_login(db_session, client, "admin1", UserRole.ADMIN)
    resp = await client.get("/api/v1/rbac-test/product-write")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_business_dept_can_access_business_write(client, db_session):
    """商务部可访问报关信息写操作端点（200）"""
    await _create_user_and_login(db_session, client, "business2", UserRole.BUSINESS_DEPT)
    resp = await client.get("/api/v1/rbac-test/business-write")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_product_dept_cannot_access_business_write(client, db_session):
    """产品部无法访问报关信息写操作端点（403）"""
    await _create_user_and_login(db_session, client, "product2", UserRole.PRODUCT_DEPT)
    resp = await client.get("/api/v1/rbac-test/business-write")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_finance_dept_can_access_finance_write(client, db_session):
    """财务部可访问价格写操作端点（200）"""
    await _create_user_and_login(db_session, client, "finance2", UserRole.FINANCE_DEPT)
    resp = await client.get("/api/v1/rbac-test/finance-write")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_product_dept_cannot_access_finance_write(client, db_session):
    """产品部无法访问价格写操作端点（403）"""
    await _create_user_and_login(db_session, client, "product3", UserRole.PRODUCT_DEPT)
    resp = await client.get("/api/v1/rbac-test/finance-write")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_unauthenticated_returns_401(client):
    """未登录访问受保护端点返回 401"""
    resp = await client.get("/api/v1/rbac-test/product-write")
    assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────────────────────
# 字段级权限辅助函数单元测试
# ──────────────────────────────────────────────────────────────────────────────

def test_can_view_purchase_price_product_dept():
    assert can_view_purchase_price(UserRole.PRODUCT_DEPT) is True


def test_can_view_purchase_price_business_dept():
    """商务部不可见采购价（FR36）"""
    assert can_view_purchase_price(UserRole.BUSINESS_DEPT) is False


def test_can_view_purchase_price_finance_dept():
    assert can_view_purchase_price(UserRole.FINANCE_DEPT) is True


def test_can_view_purchase_price_admin():
    assert can_view_purchase_price(UserRole.ADMIN) is True


def test_can_edit_customs_info_business_dept():
    assert can_edit_customs_info(UserRole.BUSINESS_DEPT) is True


def test_can_edit_customs_info_product_dept():
    """产品部不可编辑报关信息（FR12）"""
    assert can_edit_customs_info(UserRole.PRODUCT_DEPT) is False


def test_can_edit_customs_info_admin():
    assert can_edit_customs_info(UserRole.ADMIN) is True


def test_can_view_full_price_finance_dept():
    assert can_view_full_price(UserRole.FINANCE_DEPT) is True


def test_can_view_full_price_product_dept():
    """产品部只能只读查看，不能完整编辑价格（FR36）"""
    assert can_view_full_price(UserRole.PRODUCT_DEPT) is False
