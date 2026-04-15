# Story 1.3: RBAC 权限矩阵与字段级权限

**Status:** ready-for-dev
**Story Key:** 1-3-rbac-权限矩阵与字段级权限
**Epic:** 1 - 系统初始化与用户认证
**Date:** 2026-04-14

---

## User Story

As a 管理员,
I want 系统根据角色（产品部/商务部/财务部/管理员）自动控制各子模块的读写权限和敏感数据可见性,
So that 每个角色只能访问和操作其职责范围内的数据，敏感信息不会泄露给无权限用户。

---

## Acceptance Criteria

**Given** permissions.py 定义了 4 角色权限矩阵
**When** 产品部用户访问分类管理 API
**Then** 允许读写操作
**And** 商务部用户访问同一 API 时仅允许只读（403）

**Given** RBAC 依赖注入已实现
**When** 任意 Router 使用 `Depends(require_role(UserRole.PRODUCT_DEPT, UserRole.ADMIN))`
**Then** 只有产品部和管理员角色可以访问该端点
**And** 其他角色返回 403 Forbidden，错误消息为中文

**Given** 字段级权限通过不同 Pydantic Response Schema 实现
**When** 商务部用户调用字段级权限辅助函数
**Then** `can_view_purchase_price(UserRole.BUSINESS_DEPT)` 返回 False
**And** `can_view_purchase_price(UserRole.PRODUCT_DEPT)` 返回 True
**And** `can_view_purchase_price(UserRole.FINANCE_DEPT)` 返回 True

**Given** 管理员已创建初始用户数据（种子数据）
**When** 系统启动并运行 seed.py
**Then** 至少存在 4 个测试账号，分别对应产品部、商务部、财务部、管理员角色（Story 1.2 已实现，本 Story 验证无遗漏）

---

## Scope

### In Scope
- 完整重写 `erp-backend/app/core/permissions.py`：正确的 4 角色 + `require_role()` 依赖工厂 + 预定义常用依赖 + 字段级权限辅助函数
- 更新 `erp-backend/app/deps.py`：追加 `require_role` 及相关函数的导出
- 新增 RBAC 集成测试：`erp-backend/tests/routers/test_rbac.py`

### Out of Scope（不要实现）
- 前端 RBAC（按钮隐藏、菜单控制） → Story 1.4
- 实际业务 API 端点（分类/SPU/SKU 等） → Story 2.x, 3.x
- 审计日志 → Story 1.6

---

## ⚠️ 关键前置操作：依赖分支尚未合并到 main

Story 1-2 的实现代码在 `story/1-2-user-auth-system` 分支，**尚未合并到 main**。
当前分支 `story/1-3-rbac-permission-matrix` 基于 main（无 erp-backend/ 目录）。

**Dev Agent 必须首先执行 rebase：**

```bash
# 在仓库根目录执行
git fetch origin
git rebase origin/story/1-2-user-auth-system
```

rebase 完成后，`erp-backend/` 和 `erp-frontend/` 目录才会存在。验证：

```bash
ls erp-backend/app/core/permissions.py  # 应显示此文件
cat erp-backend/app/core/permissions.py  # 应看到旧的 Role 枚举占位
```

---

## 开发环境

| 变量 | 值 |
|------|-----|
| BACKEND_ROOT | `erp-backend/` |
| 后端启动 | `cd erp-backend && uvicorn app.main:app --reload` |
| 测试执行 | `cd erp-backend && pytest tests/routers/test_rbac.py -v` |

---

## 已存在文件（修改，不要重建）

| 文件 | 当前状态 | Story 1.3 操作 |
|------|---------|----------------|
| `erp-backend/app/core/permissions.py` | 错误的 `Role` 枚举（MANAGER/OPERATOR/VIEWER）+ `require_permission` NotImplementedError 占位 | **完整重写** |
| `erp-backend/app/deps.py` | `get_current_user` + `get_db` 已实现 | **追加**导入和 `__all__` |

## 新增文件清单

- `erp-backend/tests/routers/test_rbac.py` — RBAC 路由权限集成测试

---

## 后端技术规范

### 1. permissions.py（完整重写）

**文件路径**：`erp-backend/app/core/permissions.py`

```python
"""
RBAC 权限矩阵与角色访问控制。

使用方式：
    # 方式一：预定义常用依赖
    @router.post("/categories")
    async def create_category(
        current_user: User = Depends(require_product_or_admin)
    ): ...

    # 方式二：动态指定角色列表
    @router.post("/prices")
    async def create_price(
        current_user: User = Depends(require_role(UserRole.FINANCE_DEPT, UserRole.ADMIN))
    ): ...
"""

from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.deps import get_current_user
from app.models.user import User, UserRole


def require_role(*roles: UserRole) -> Callable[..., User]:
    """
    依赖工厂：要求当前用户具有指定角色之一。

    用法：Depends(require_role(UserRole.PRODUCT_DEPT, UserRole.ADMIN))
    验证通过返回当前用户，否则抛 HTTP 403（中文错误消息）。
    """
    role_set = set(roles)

    async def _check_role(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in role_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权限执行此操作",
            )
        return current_user

    return _check_role


# ──────────────────────────────────────────────────────────────────────────────
# 预定义常用依赖（在各模块 Router 中直接使用，避免重复写角色列表）
# ──────────────────────────────────────────────────────────────────────────────

# 分类管理、SPU、产品资料、证书、FAQ 写操作：产品部 + 管理员
require_product_or_admin = require_role(UserRole.PRODUCT_DEPT, UserRole.ADMIN)

# SKU 报关信息写操作：商务部 + 管理员（FR12）
require_business_or_admin = require_role(UserRole.BUSINESS_DEPT, UserRole.ADMIN)

# 销售价格管理写操作：财务部 + 管理员（FR24-FR27）
require_finance_or_admin = require_role(UserRole.FINANCE_DEPT, UserRole.ADMIN)

# 数据导入操作：产品部 + 管理员（FR28-FR31）
require_import_permission = require_role(UserRole.PRODUCT_DEPT, UserRole.ADMIN)

# 管理员专属（枚举值配置等）
require_admin = require_role(UserRole.ADMIN)


# ──────────────────────────────────────────────────────────────────────────────
# 字段级权限辅助函数（供 Service/Router 层决定使用哪个 Pydantic Schema）
# ──────────────────────────────────────────────────────────────────────────────

def can_view_purchase_price(role: UserRole) -> bool:
    """
    采购价（purchase_price）可见性：仅产品部、财务部、管理员可见（FR36）。
    商务部不可见。
    """
    return role in {UserRole.PRODUCT_DEPT, UserRole.FINANCE_DEPT, UserRole.ADMIN}


def can_edit_customs_info(role: UserRole) -> bool:
    """
    报关信息可编辑性：仅商务部、管理员可编辑（FR12）。
    产品部只读。
    """
    return role in {UserRole.BUSINESS_DEPT, UserRole.ADMIN}


def can_view_full_price(role: UserRole) -> bool:
    """
    完整价格数据（含全部区域价格）：仅财务部、管理员可完整查看（FR36）。
    产品部可只读查看已生效价格，商务部不可见价格详情。
    """
    return role in {UserRole.FINANCE_DEPT, UserRole.ADMIN}
```

---

### 2. deps.py 更新（追加导出，不改动已有代码）

在文件末尾追加 import 和 `__all__`（如 `__all__` 已存在则更新）：

```python
# 追加在文件末尾（原有 get_current_user / get_db 代码不动）
from app.core.permissions import (  # noqa: E402
    can_edit_customs_info,
    can_view_full_price,
    can_view_purchase_price,
    require_admin,
    require_business_or_admin,
    require_finance_or_admin,
    require_import_permission,
    require_product_or_admin,
    require_role,
)

__all__ = [
    "get_db",
    "get_current_user",
    "require_role",
    "require_product_or_admin",
    "require_business_or_admin",
    "require_finance_or_admin",
    "require_import_permission",
    "require_admin",
    "can_view_purchase_price",
    "can_edit_customs_info",
    "can_view_full_price",
]
```

**注意**：`deps.py` 中的 `get_current_user` 函数原样保留，不改动。只追加内容。

---

### 3. 字段级权限 Schema 模式（规范说明）

字段级权限通过不同的 Pydantic Response Schema + 辅助函数实现。以下为未来所有有敏感字段模块都必须遵循的模式（Story 1.3 建立规范，Story 3.1+ 实际使用）：

```python
# 模式示例（Story 3.1 的 app/schemas/spus.py 将按此实现）:

class SPUBaseResponse(BaseModel):
    """不含敏感字段版本 — 商务部用户"""
    id: int
    spu_code: str
    name: str
    # ... 非敏感字段
    model_config = {"from_attributes": True}

class SPUFullResponse(SPUBaseResponse):
    """含敏感字段版本 — 产品部/财务部/管理员"""
    purchase_price: Decimal | None = None
    purchase_currency: str | None = None

# Router 中的使用方式：
async def get_spu_detail(spu_id: int, current_user: User = Depends(get_current_user)):
    spu = await spu_service.get(spu_id)
    if can_view_purchase_price(current_user.role):
        return SPUFullResponse.model_validate(spu)
    return SPUBaseResponse.model_validate(spu)
```

**Story 1.3 的职责**：定义辅助函数（`can_view_purchase_price` 等），并通过单元测试验证其正确性。实际 Schema 类在 Story 3.x 中实现。

---

### 4. RBAC 集成测试（`tests/routers/test_rbac.py`）

测试策略：在测试文件中注册临时测试路由，注入 `require_role()` 依赖，验证 200/403 行为。

```python
"""
RBAC 集成测试：验证 require_role() 依赖对不同角色的访问控制。

测试方案：在 app 上临时注册测试专用路由（模块级，仅对测试进程可见）。
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import (
    can_edit_customs_info,
    can_view_full_price,
    can_view_purchase_price,
    require_business_or_admin,
    require_finance_or_admin,
    require_product_or_admin,
)
from app.core.security import hash_password
from app.deps import get_current_user
from app.main import app
from app.models.user import User, UserRole


# ──────────────────────────────────────────────────────────────────────────────
# 注册测试专用路由（模块导入时执行一次）
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


app.include_router(_rbac_test_router)


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
```

---

## 架构合规清单

| 规则 | 验证点 |
|------|--------|
| 所有 Router 通过 `Depends()` 注入权限检查 | `require_role()` 内部使用 `Depends(get_current_user)` |
| 403 错误消息为中文 | `detail="无权限执行此操作"` |
| 不修改 UserRole 枚举 | `UserRole` 已在 Story 1.2 的 `app/models/user.py` 正确定义，直接导入使用 |
| 软删除 | 权限层不直接操作数据库，无需处理 |
| 不重新定义 `Role` 枚举 | 完整删除 permissions.py 中的旧 `Role(str, Enum)` 类 |

---

## 前置故事智能（Story 1.2 经验）

**必须遵守，否则会踩坑：**

| 坑 | 正确做法 |
|----|----------|
| `permissions.py` 旧的 `Role` 枚举（MANAGER/OPERATOR/VIEWER）是错误占位 | **完整删除**，不要保留或继承它 |
| `require_role()` 返回的内部函数里的 `Depends()` 能被 FastAPI 正确解析 | 这是 FastAPI 标准模式，放心使用 |
| `deps.py` 中追加导入可能导致循环 | `permissions.py` → 导入 `deps.py`；`deps.py` → 追加导入 `permissions.py`，会循环！ |
| **循环导入解决方案** | `deps.py` **不要**反过来 import `permissions.py`；各 Router 文件直接 `from app.core.permissions import require_product_or_admin` 即可。`deps.py` 不需要导出 permissions 函数（删除 `__all__` 中对 permissions 的导出方案） |
| `passlib` 已替换为 `bcrypt` 直调 | `hash_password` 在 `app/core/security.py` 中，测试直接导入使用 |
| 测试注册路由必须在测试模块导入时完成 | 路由注册写在模块顶层（不在 fixture 内），`app.include_router(_rbac_test_router)` 只执行一次 |
| 多个测试共享同一 `client` 时 Cookie 会叠加 | `_create_user_and_login` 辅助函数在每个测试中创建不同 username 的用户，避免冲突 |
| SQLite 内存数据库每个测试独立（conftest.py 已处理） | 直接使用 `client` 和 `db_session` fixtures，不需要重建 |

### 关于 deps.py 循环导入的说明

**不要**在 `deps.py` 中导入 `permissions.py` 的函数。正确用法是各 Router 文件直接导入：

```python
# 正确：在 routers/product_categories.py 中
from app.core.permissions import require_product_or_admin
from app.deps import get_current_user  # 只需要 get_current_user 时才用

@router.post("/categories")
async def create(current_user: User = Depends(require_product_or_admin)):
    ...
```

`deps.py` 只保留 `get_db` 和 `get_current_user`，**不要追加** `permissions.py` 的导入。

---

## 完成标准

- [ ] `permissions.py` 中旧的 `Role` 枚举和 `require_permission` 函数被完整删除
- [ ] `require_role()` 工厂函数实现，返回正确的 FastAPI 依赖
- [ ] 预定义依赖（`require_product_or_admin` 等 5 个）全部实现
- [ ] `can_view_purchase_price` / `can_edit_customs_info` / `can_view_full_price` 三个辅助函数实现
- [ ] `tests/routers/test_rbac.py` 新建，包含 ≥ 9 个路由测试场景 + ≥ 9 个字段级权限单元测试
- [ ] 所有测试通过：`pytest tests/routers/test_rbac.py -v`
- [ ] 全量测试无回归：`pytest` 通过（含 Story 1.1、1.2 的遗留测试）

---

## Dev Agent Record

### Implementation Notes

- 完整重写 `app/core/permissions.py`：删除旧 `Role` 枚举和 `require_permission` 占位函数，实现 `require_role()` 工厂 + 5 个预定义依赖 + 3 个字段级权限辅助函数
- `deps.py` 保持不变，避免循环导入（`permissions.py` → `deps.py`，反向导入会循环）
- 测试路由注册在模块顶层（不在 fixture 内），确保只执行一次
- 每个集成测试使用不同 username 创建用户，避免 Cookie 叠加干扰

### File List

- `erp-backend/app/core/permissions.py` — 完整重写
- `erp-backend/tests/routers/test_rbac.py` — 新建（18 个测试：9 路由集成 + 9 字段级权限单元）

### Change Log

- 2026-04-14: Story 实现完成，31 个测试全部通过（含 Story 1.1、1.2 遗留测试无回归）
