from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
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


async def _create_category_tree(
    client: AsyncClient,
) -> tuple[int, int, int]:
    root = await client.post(
        "/api/v1/products/categories",
        json={"code": f"L1-{uuid.uuid4().hex[:6]}", "name": "一级分类"},
    )
    level1_id = root.json()["id"]
    second = await client.post(
        "/api/v1/products/categories",
        json={
            "code": f"L2-{uuid.uuid4().hex[:6]}",
            "name": "二级分类",
            "parent_id": level1_id,
        },
    )
    level2_id = second.json()["id"]
    third = await client.post(
        "/api/v1/products/categories",
        json={
            "code": f"L3-{uuid.uuid4().hex[:6]}",
            "name": "三级分类",
            "parent_id": level2_id,
        },
    )
    return level1_id, level2_id, third.json()["id"]


def _spu_payload(
    *,
    code: str,
    name: str,
    category_ids: tuple[int, int, int],
    supplier_name: str = "供应商A",
    purchase_price: str | None = "128.50",
) -> dict:
    level1_id, level2_id, level3_id = category_ids
    return {
        "code": code,
        "name": name,
        "level1_category_id": level1_id,
        "level2_category_id": level2_id,
        "level3_category_id": level3_id,
        "customer_warranty_months": 24,
        "unit": "台",
        "restricted_countries": ["US", "DE"],
        "supplier_name": supplier_name,
        "manufacturer_model": "M-100",
        "purchase_price": purchase_price,
        "purchase_warranty_months": 12,
        "supplier_warranty_notes": "标准质保",
        "invoice_infos": [
            {
                "invoice_name": "超声设备",
                "invoice_unit": "台",
                "invoice_model": "INV-1",
                "company_subject": "华青医疗",
                "sort_order": 1,
            }
        ],
    }


@pytest.mark.asyncio
async def test_product_user_can_create_spu(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    category_ids = await _create_category_tree(client)

    response = await client.post(
        "/api/v1/spus",
        json=_spu_payload(code="SPU001", name="彩超主机", category_ids=category_ids),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "SPU001"
    assert data["supplier_name"] == "供应商A"
    assert data["purchase_price"] == "128.50"
    assert data["invoice_infos"][0]["invoice_name"] == "超声设备"


@pytest.mark.asyncio
async def test_spu_code_must_be_unique(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    category_ids = await _create_category_tree(client)

    first = await client.post(
        "/api/v1/spus",
        json=_spu_payload(code="SPU002", name="设备A", category_ids=category_ids),
    )
    second = await client.post(
        "/api/v1/spus",
        json=_spu_payload(code="SPU002", name="设备B", category_ids=category_ids),
    )

    assert first.status_code == 201
    assert second.status_code == 400
    assert second.json()["message"] == "SPU编码已存在"


@pytest.mark.asyncio
async def test_cannot_update_spu_code(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    category_ids = await _create_category_tree(client)

    create_response = await client.post(
        "/api/v1/spus",
        json=_spu_payload(code="SPU003", name="设备C", category_ids=category_ids),
    )
    spu_id = create_response.json()["id"]

    response = await client.patch(
        f"/api/v1/spus/{spu_id}",
        json={"code": "SPU003-NEW"},
    )

    assert response.status_code == 400
    assert response.json()["message"] == "SPU编码创建后不可修改"


@pytest.mark.asyncio
async def test_invoice_info_must_not_be_empty(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    category_ids = await _create_category_tree(client)
    payload = _spu_payload(code="SPU004", name="设备D", category_ids=category_ids)
    payload["invoice_infos"] = []

    response = await client.post("/api/v1/spus", json=payload)

    assert response.status_code == 400
    assert response.json()["message"] == "开票信息至少需要一条"


@pytest.mark.asyncio
async def test_business_user_can_read_but_cannot_write_spu(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    category_ids = await _create_category_tree(client)
    create_response = await client.post(
        "/api/v1/spus",
        json=_spu_payload(code="SPU005", name="设备E", category_ids=category_ids),
    )
    spu_id = create_response.json()["id"]

    await _login_as_role(client, db_session, UserRole.BUSINESS_DEPT)
    list_response = await client.get("/api/v1/spus")
    detail_response = await client.get(f"/api/v1/spus/{spu_id}")
    write_response = await client.patch(
        f"/api/v1/spus/{spu_id}",
        json={"name": "修改失败"},
    )

    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert write_response.status_code == 403
    assert write_response.json()["detail"] == "无权限执行此操作"
    assert "purchase_price" not in detail_response.json()
    assert "purchase_price" not in list_response.json()["items"][0]


@pytest.mark.asyncio
async def test_finance_user_can_view_purchase_price(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    category_ids = await _create_category_tree(client)
    create_response = await client.post(
        "/api/v1/spus",
        json=_spu_payload(code="SPU006", name="设备F", category_ids=category_ids),
    )
    spu_id = create_response.json()["id"]

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    list_response = await client.get("/api/v1/spus")
    detail_response = await client.get(f"/api/v1/spus/{spu_id}")

    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert list_response.json()["items"][0]["purchase_price"] == "128.50"
    assert detail_response.json()["purchase_price"] == "128.50"


@pytest.mark.asyncio
async def test_list_supports_category_supplier_and_keyword_filters(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    category_ids_a = await _create_category_tree(client)
    category_ids_b = await _create_category_tree(client)

    await client.post(
        "/api/v1/spus",
        json=_spu_payload(
            code="SPU007",
            name="超声刀系统",
            category_ids=category_ids_a,
            supplier_name="供应商甲",
        ),
    )
    await client.post(
        "/api/v1/spus",
        json=_spu_payload(
            code="SPU008",
            name="监护仪",
            category_ids=category_ids_b,
            supplier_name="供应商乙",
        ),
    )

    response = await client.get(
        "/api/v1/spus",
        params={
            "level1_category_id": category_ids_a[0],
            "supplier_name": "供应商甲",
            "keyword": "超声",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["code"] == "SPU007"


@pytest.mark.asyncio
async def test_cannot_change_supplier_when_linked_sku_has_business_reference(
    client: AsyncClient,
    db_session: AsyncSession,
):
    metadata = MetaData()
    skus = Table(
        "skus",
        metadata,
        Column("id", Integer, primary_key=True, autoincrement=True),
        Column("spu_id", Integer, nullable=False),
        Column("deleted_at", DateTime, nullable=True),
    )
    sales_order_items = Table(
        "sales_order_items",
        metadata,
        Column("id", Integer, primary_key=True, autoincrement=True),
        Column("sku_id", Integer, nullable=False),
        Column("deleted_at", DateTime, nullable=True),
    )
    connection = await db_session.connection()
    await connection.run_sync(metadata.create_all)

    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    category_ids = await _create_category_tree(client)
    create_response = await client.post(
        "/api/v1/spus",
        json=_spu_payload(code="SPU009", name="设备G", category_ids=category_ids),
    )
    spu_id = create_response.json()["id"]

    await db_session.execute(insert(skus).values(spu_id=spu_id, deleted_at=None))
    sku_id = (
        await db_session.execute(skus.select().order_by(skus.c.id.desc()).limit(1))
    ).scalar_one()
    await db_session.execute(
        insert(sales_order_items).values(sku_id=sku_id, deleted_at=None)
    )
    await db_session.commit()

    response = await client.patch(
        f"/api/v1/spus/{spu_id}",
        json={"supplier_name": "供应商B"},
    )

    assert response.status_code == 400
    assert response.json()["message"] == "该SPU下已有SKU被业务引用，供应商不可变更"


@pytest.mark.asyncio
async def test_category_chain_must_match(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    category_ids_a = await _create_category_tree(client)
    category_ids_b = await _create_category_tree(client)
    payload = _spu_payload(code="SPU010", name="设备H", category_ids=category_ids_a)
    payload["level3_category_id"] = category_ids_b[2]

    response = await client.post("/api/v1/spus", json=payload)

    assert response.status_code == 400
    assert response.json()["message"] == "分类层级不匹配"


@pytest.mark.asyncio
async def test_category_tree_endpoint_remains_available_for_spu_form(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    category_ids = await _create_category_tree(client)

    response = await client.get("/api/v1/products/categories/tree")

    assert response.status_code == 200
    data = response.json()
    assert data[0]["id"] == category_ids[0]
