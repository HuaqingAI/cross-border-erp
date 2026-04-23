from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.system_enum import SystemEnum
from app.models.user import User, UserRole


async def _login_as_role(
    client: AsyncClient,
    db_session: AsyncSession,
    role: UserRole,
) -> None:
    username = f"{role.value}-{uuid.uuid4().hex[:8]}"
    user = User(
        username=username,
        password_hash=hash_password("Test123!"),
        role=role,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    response = await client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "Test123!"},
    )
    assert response.status_code == 200


async def _seed_enum(
    db_session: AsyncSession,
    *,
    enum_group: str,
    enum_key: str,
    enum_value: str,
    description: str = "",
    sort_order: int = 0,
    is_enabled: bool = True,
) -> SystemEnum:
    entity = SystemEnum(
        enum_group=enum_group,
        enum_key=enum_key,
        enum_value=enum_value,
        description=description or None,
        sort_order=sort_order,
        is_enabled=is_enabled,
    )
    db_session.add(entity)
    await db_session.commit()
    await db_session.refresh(entity)
    return entity


@pytest.mark.asyncio
async def test_authenticated_user_can_only_list_enabled_enums(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _seed_enum(
        db_session,
        enum_group="unit",
        enum_key="台",
        enum_value="台",
        description="系统默认单位",
        sort_order=10,
        is_enabled=True,
    )
    await _seed_enum(
        db_session,
        enum_group="unit",
        enum_key="件",
        enum_value="件",
        description="系统默认单位",
        sort_order=20,
        is_enabled=False,
    )

    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    list_response = await client.get("/api/v1/enums", params={"group": "unit"})
    assert list_response.status_code == 200
    assert [item["enum_key"] for item in list_response.json()] == ["台"]

    list_all_response = await client.get(
        "/api/v1/enums",
        params={"group": "unit", "include_disabled": True},
    )
    assert list_all_response.status_code == 200
    assert [item["enum_key"] for item in list_all_response.json()] == ["台"]


@pytest.mark.asyncio
async def test_only_admin_can_list_enum_groups(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _seed_enum(
        db_session,
        enum_group="unit",
        enum_key="台",
        enum_value="台",
        description="系统默认单位",
        sort_order=10,
        is_enabled=True,
    )

    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    forbidden_response = await client.get("/api/v1/enums/groups")
    assert forbidden_response.status_code == 403

    await _login_as_role(client, db_session, UserRole.ADMIN)
    groups_response = await client.get("/api/v1/enums/groups")
    assert groups_response.status_code == 200
    groups = groups_response.json()
    unit_group = next(item for item in groups if item["key"] == "unit")
    assert unit_group["total_count"] == 1
    assert unit_group["enabled_count"] == 1


@pytest.mark.asyncio
async def test_admin_can_create_update_and_delete_enum(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.ADMIN)

    create_response = await client.post(
        "/api/v1/enums",
        json={
            "enum_group": "currency",
            "enum_key": " usd ",
            "enum_value": "美元",
            "description": "测试币种",
            "sort_order": 10,
            "is_enabled": True,
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["enum_group"] == "currency"
    assert created["enum_key"] == "USD"
    assert created["enum_value"] == "美元"

    update_response = await client.patch(
        f"/api/v1/enums/{created['id']}",
        json={
            "enum_value": "美元(更新)",
            "sort_order": 99,
            "is_enabled": False,
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["enum_value"] == "美元(更新)"
    assert updated["sort_order"] == 99
    assert updated["is_enabled"] is False

    delete_response = await client.delete(f"/api/v1/enums/{created['id']}")
    assert delete_response.status_code == 204

    list_response = await client.get(
        "/api/v1/enums",
        params={"group": "currency", "include_disabled": True},
    )
    assert list_response.status_code == 200
    assert list_response.json() == []


@pytest.mark.asyncio
async def test_non_admin_cannot_write_enum(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/enums",
        json={
            "enum_group": "unit",
            "enum_key": "箱",
            "enum_value": "箱",
            "sort_order": 10,
            "is_enabled": True,
        },
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_global_cannot_be_disabled_or_deleted(
    client: AsyncClient,
    db_session: AsyncSession,
):
    global_region = await _seed_enum(
        db_session,
        enum_group="country_region",
        enum_key="GLOBAL",
        enum_value="全球",
        description="系统保留默认区域",
        sort_order=0,
        is_enabled=True,
    )

    await _login_as_role(client, db_session, UserRole.ADMIN)

    disable_response = await client.patch(
        f"/api/v1/enums/{global_region.id}",
        json={"is_enabled": False},
    )
    assert disable_response.status_code == 400
    assert disable_response.json()["message"] == "GLOBAL 为系统保留值，禁止停用"

    delete_response = await client.delete(f"/api/v1/enums/{global_region.id}")
    assert delete_response.status_code == 400
    assert delete_response.json()["message"] == "GLOBAL 为系统保留值，禁止删除"


@pytest.mark.asyncio
async def test_admin_cannot_create_non_standard_country_region_code(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.ADMIN)

    response = await client.post(
        "/api/v1/enums",
        json={
            "enum_group": "country_region",
            "enum_key": "CN-TEST",
            "enum_value": "测试区域",
            "sort_order": 10,
            "is_enabled": True,
        },
    )

    assert response.status_code == 400
    assert response.json()["message"] == "国家/地区编码必须为标准编码（如 CN、US、GLOBAL）"


@pytest.mark.asyncio
async def test_global_cannot_be_renamed(
    client: AsyncClient,
    db_session: AsyncSession,
):
    global_region = await _seed_enum(
        db_session,
        enum_group="country_region",
        enum_key="GLOBAL",
        enum_value="全球",
        description="系统保留默认区域",
        sort_order=0,
        is_enabled=True,
    )

    await _login_as_role(client, db_session, UserRole.ADMIN)

    response = await client.patch(
        f"/api/v1/enums/{global_region.id}",
        json={"enum_value": "全区域"},
    )

    assert response.status_code == 400
    assert response.json()["message"] == "GLOBAL 为系统保留值，禁止修改显示值"
