"""
生产初始化管理员账号。

用法：
docker compose exec -T api python -m app.db.bootstrap_admin
"""

import asyncio
import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User, UserRole


async def bootstrap_admin() -> None:
    username = os.getenv("INIT_ADMIN_USERNAME", "").strip()
    password = os.getenv("INIT_ADMIN_PASSWORD", "").strip()

    if not username or not password:
        print("跳过管理员初始化：未提供 INIT_ADMIN_USERNAME / INIT_ADMIN_PASSWORD")
        return

    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(
            select(User).where(
                User.username == username,
                User.deleted_at.is_(None),
            )
        )
        existing_user = result.scalar_one_or_none()
        if existing_user:
            print(f"管理员账号已存在，跳过创建：{username}")
            await engine.dispose()
            return

        user = User(
            username=username,
            password_hash=hash_password(password),
            role=UserRole.ADMIN,
            is_active=True,
        )
        session.add(user)
        await session.commit()

    await engine.dispose()
    print(f"管理员账号创建完成：{username}")


if __name__ == "__main__":
    asyncio.run(bootstrap_admin())
