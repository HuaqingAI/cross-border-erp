"""
开发/测试种子数据 — 4 个测试用户，覆盖所有角色。
用法：cd erp-backend && python -m app.db.seed
"""

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User, UserRole

SEED_USERS = [
    {"username": "admin", "password": "Admin123!", "role": UserRole.ADMIN},
    {"username": "product_user", "password": "Test123!", "role": UserRole.PRODUCT_DEPT},
    {"username": "business_user", "password": "Test123!", "role": UserRole.BUSINESS_DEPT},
    {"username": "finance_user", "password": "Test123!", "role": UserRole.FINANCE_DEPT},
]


async def seed() -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        for u in SEED_USERS:
            user = User(
                username=u["username"],
                password_hash=hash_password(u["password"]),
                role=u["role"],
                is_active=True,
            )
            session.add(user)
        await session.commit()

    await engine.dispose()
    print("种子数据写入完成")
    for u in SEED_USERS:
        print(f"  {u['role'].value}: {u['username']} / {u['password']}")


if __name__ == "__main__":
    asyncio.run(seed())
