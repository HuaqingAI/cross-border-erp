"""
测试配置：使用 SQLite 共享内存数据库，每个测试函数独立一个命名数据库。
在 CI 环境（有 MySQL）中，通过环境变量 TEST_DB_URL 覆盖使用 MySQL。
"""

import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401 — 确保所有 Model 注册到 Base.metadata
from app.db.base import Base
from app.db.session import get_db
from app.main import app


def make_test_db_url() -> str:
    """每次调用生成唯一的共享内存 SQLite URL（测试间互不干扰）。"""
    ci_url = os.getenv("TEST_DB_URL")
    if ci_url:
        return ci_url
    db_name = uuid.uuid4().hex
    return f"sqlite+aiosqlite:///file:{db_name}?mode=memory&cache=shared&uri=true"


@pytest_asyncio.fixture
async def test_engine():
    """每个测试独立的内存 SQLite 数据库（共享连接，让 client 和 db_session 看到同一数据）。"""
    url = make_test_db_url()
    # Only SQLite accepts `check_same_thread`; MySQL (CI) should not receive it.
    connect_args = {"check_same_thread": False} if url.startswith("sqlite+") else {}
    engine = create_async_engine(url, connect_args=connect_args)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    async_session = async_sessionmaker(test_engine, expire_on_commit=False)
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture
async def client(test_engine):
    """ASGI client，DB 依赖替换为测试用 engine。"""
    async_session = async_sessionmaker(test_engine, expire_on_commit=False)

    async def override_get_db():
        async with async_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession):
    from app.core.security import hash_password
    from app.models.user import User, UserRole

    user = User(
        username="testuser",
        password_hash=hash_password("TestPass123!"),
        role=UserRole.PRODUCT_DEPT,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user
