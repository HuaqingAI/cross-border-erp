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
# 注：当前与 require_product_or_admin 权限一致，独立命名以便未来单独调整
# （例如若导入功能需对商务部开放，只需修改此处，不影响其他产品操作）
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
