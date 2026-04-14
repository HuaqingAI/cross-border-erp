# Story 1.2 将实现 JWT 签发/验证和密码哈希
# 本文件为占位，预留接口签名供后续 Story 填充

from typing import Any


def create_access_token(data: dict[str, Any]) -> str:
    raise NotImplementedError("Story 1.2 将实现此方法")


def verify_token(token: str) -> dict[str, Any]:
    raise NotImplementedError("Story 1.2 将实现此方法")


def hash_password(password: str) -> str:
    raise NotImplementedError("Story 1.2 将实现此方法")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    raise NotImplementedError("Story 1.2 将实现此方法")
