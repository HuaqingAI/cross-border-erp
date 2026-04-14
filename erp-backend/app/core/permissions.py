# Story 1.3 将实现 RBAC 权限矩阵与字段级权限
# 本文件为占位，预留接口供后续 Story 填充

from enum import Enum


class Role(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    OPERATOR = "operator"
    VIEWER = "viewer"


def require_permission(resource: str, action: str):
    """依赖注入占位 — Story 1.3 将实现此装饰器"""
    raise NotImplementedError("Story 1.3 将实现此方法")
