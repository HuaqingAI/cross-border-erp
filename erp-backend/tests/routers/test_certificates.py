from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient
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


async def _create_category_tree(client: AsyncClient) -> tuple[int, int, int]:
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
        "manufacturer_model": f"{name}-MODEL",
        "purchase_price": "188.00",
        "purchase_warranty_months": 12,
        "supplier_warranty_notes": "标准质保",
        "invoice_infos": [
            {
                "invoice_name": f"{name}开票名",
                "invoice_unit": "台",
                "invoice_model": "INV-1",
                "company_subject": "华青医疗",
                "sort_order": 1,
            }
        ],
    }


async def _create_spu(
    client: AsyncClient,
    *,
    code: str,
    name: str,
    supplier_name: str = "供应商A",
) -> dict:
    category_ids = await _create_category_tree(client)
    response = await client.post(
        "/api/v1/spus",
        json=_spu_payload(
            code=code,
            name=name,
            category_ids=category_ids,
            supplier_name=supplier_name,
        ),
    )
    assert response.status_code == 201
    data = response.json()
    data["category_ids"] = category_ids
    return data


def _certificate_payload(
    *,
    name: str,
    certificate_no: str,
    certificate_type: str = "CE",
    ownership_type: str = "通用",
    spu_ids: list[int] | None = None,
    category_ids: list[int] | None = None,
    valid_from: date | None = None,
    valid_to: date | None = None,
) -> dict:
    return {
        "name": name,
        "certificate_no": certificate_no,
        "certificate_type": certificate_type,
        "issuing_authority": "TUV",
        "valid_from": str(valid_from or (date.today() - timedelta(days=10))),
        "valid_to": str(valid_to or (date.today() + timedelta(days=60))),
        "ownership_type": ownership_type,
        "spu_ids": spu_ids or [],
        "category_ids": category_ids or [],
        "file_object_key": "certificates/demo.pdf",
        "file_url": "https://example.com/certificates/demo.pdf",
        "file_name": "demo.pdf",
        "remarks": "首版证书",
    }


@pytest.mark.asyncio
async def test_product_user_can_create_general_certificate(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(
            name="通用CE证书",
            certificate_no="CERT-001",
        ),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["certificate_no"] == "CERT-001"
    assert data["ownership_type"] == "通用"
    assert data["ownership_summary"] == "通用（全部产品）"
    assert data["validity_status"] == "有效"
    assert data["spu_ids"] == []
    assert data["category_ids"] == []


@pytest.mark.asyncio
async def test_certificate_no_must_be_unique(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    first = await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(name="证书A", certificate_no="CERT-002"),
    )
    second = await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(name="证书B", certificate_no="CERT-002"),
    )

    assert first.status_code == 201
    assert second.status_code == 400
    assert second.json()["message"] == "证书编号已存在"


@pytest.mark.asyncio
async def test_deleted_certificate_still_blocks_reusing_certificate_no(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    create_response = await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(name="历史证书", certificate_no="CERT-002A"),
    )
    certificate_id = create_response.json()["id"]

    delete_response = await client.delete(f"/api/v1/certificates/{certificate_id}")
    recreate_response = await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(name="新证书", certificate_no="CERT-002A"),
    )

    assert delete_response.status_code == 204
    assert recreate_response.status_code == 400
    assert recreate_response.json()["message"] == "证书编号已存在"


@pytest.mark.asyncio
async def test_certificate_validity_dates_must_be_ordered(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(
            name="无效日期证书",
            certificate_no="CERT-003",
            valid_from=date.today(),
            valid_to=date.today(),
        ),
    )

    assert response.status_code == 400
    assert response.json()["message"] == "有效期起始日期必须早于结束日期"


@pytest.mark.asyncio
async def test_product_user_can_create_spu_owned_certificate(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu_a = await _create_spu(client, code="SPU-CERT-001", name="彩超平台")
    spu_b = await _create_spu(client, code="SPU-CERT-002", name="监护平台")

    response = await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(
            name="SPU证书",
            certificate_no="CERT-004",
            ownership_type="SPU归属",
            spu_ids=[spu_a["id"], spu_b["id"], spu_a["id"]],
        ),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["ownership_type"] == "SPU归属"
    assert data["spu_ids"] == [spu_a["id"], spu_b["id"]]
    assert data["category_ids"] == []
    assert len(data["spus"]) == 2
    assert {item["spu_code"] for item in data["spus"]} == {
        "SPU-CERT-001",
        "SPU-CERT-002",
    }


@pytest.mark.asyncio
async def test_product_user_can_create_category_owned_certificate(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    category_ids = await _create_category_tree(client)

    response = await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(
            name="分类证书",
            certificate_no="CERT-005",
            ownership_type="按分类",
            category_ids=[category_ids[1], category_ids[2]],
        ),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["ownership_type"] == "按分类"
    assert data["spu_ids"] == []
    assert data["category_ids"] == [category_ids[1], category_ids[2]]
    assert len(data["categories"]) == 2
    assert {item["level"] for item in data["categories"]} == {2, 3}


@pytest.mark.asyncio
async def test_update_certificate_can_switch_ownership_type(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    category_ids = await _create_category_tree(client)
    create_response = await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(
            name="待更新证书",
            certificate_no="CERT-006",
        ),
    )
    certificate_id = create_response.json()["id"]

    response = await client.patch(
        f"/api/v1/certificates/{certificate_id}",
        json={
            "ownership_type": "按分类",
            "category_ids": [category_ids[2]],
            "remarks": "切换为分类归属",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["ownership_type"] == "按分类"
    assert data["category_ids"] == [category_ids[2]]
    assert data["spu_ids"] == []
    assert data["remarks"] == "切换为分类归属"


@pytest.mark.asyncio
async def test_update_certificate_can_switch_from_targeted_to_general_without_explicit_empty_ids(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(client, code="SPU-CERT-002A", name="切换平台")
    create_response = await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(
            name="待切换通用证书",
            certificate_no="CERT-006A",
            ownership_type="SPU归属",
            spu_ids=[spu["id"]],
        ),
    )
    certificate_id = create_response.json()["id"]

    response = await client.patch(
        f"/api/v1/certificates/{certificate_id}",
        json={
            "ownership_type": "通用",
            "remarks": "切换为通用归属",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["ownership_type"] == "通用"
    assert data["ownership_summary"] == "通用（全部产品）"
    assert data["spu_ids"] == []
    assert data["category_ids"] == []
    assert data["spus"] == []
    assert data["categories"] == []
    assert data["remarks"] == "切换为通用归属"


@pytest.mark.asyncio
async def test_spu_ownership_requires_at_least_one_spu(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(
            name="空SPU证书",
            certificate_no="CERT-007",
            ownership_type="SPU归属",
            spu_ids=[],
        ),
    )

    assert response.status_code == 400
    assert response.json()["message"] == "SPU归属至少需要选择一个SPU"


@pytest.mark.asyncio
async def test_general_ownership_rejects_targeted_ids(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(client, code="SPU-CERT-004", name="冲突平台")
    category_ids = await _create_category_tree(client)

    response = await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(
            name="冲突归属证书",
            certificate_no="CERT-007A",
            ownership_type="通用",
            spu_ids=[spu["id"]],
            category_ids=[category_ids[2]],
        ),
    )

    assert response.status_code == 400
    assert response.json()["message"] == "通用归属不能指定SPU或分类"


@pytest.mark.asyncio
async def test_list_supports_type_ownership_status_and_keyword_filters(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(client, code="SPU-CERT-003", name="手术平台")
    category_ids = await _create_category_tree(client)

    await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(
            name="有效CE证书",
            certificate_no="CERT-008",
            certificate_type="CE",
            ownership_type="通用",
            valid_to=date.today() + timedelta(days=45),
        ),
    )
    await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(
            name="即将过期FDA证书",
            certificate_no="CERT-009",
            certificate_type="FDA",
            ownership_type="SPU归属",
            spu_ids=[spu["id"]],
            valid_to=date.today() + timedelta(days=10),
        ),
    )
    await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(
            name="已过期ISO证书",
            certificate_no="CERT-010",
            certificate_type="ISO13485",
            ownership_type="按分类",
            category_ids=[category_ids[2]],
            valid_to=date.today() - timedelta(days=1),
        ),
    )

    response = await client.get(
        "/api/v1/certificates",
        params={
            "certificate_type": "FDA",
            "ownership_type": "SPU归属",
            "validity_status": "即将过期",
            "keyword": "CERT-009",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["certificate_no"] == "CERT-009"
    assert data["items"][0]["validity_status"] == "即将过期"


@pytest.mark.asyncio
async def test_business_user_can_read_but_cannot_write_certificate(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    create_response = await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(
            name="权限测试证书",
            certificate_no="CERT-011",
        ),
    )
    certificate_id = create_response.json()["id"]

    await _login_as_role(client, db_session, UserRole.BUSINESS_DEPT)
    list_response = await client.get("/api/v1/certificates")
    detail_response = await client.get(f"/api/v1/certificates/{certificate_id}")
    write_response = await client.patch(
        f"/api/v1/certificates/{certificate_id}",
        json={"remarks": "修改失败"},
    )

    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert write_response.status_code == 403
    assert write_response.json()["detail"] == "无权限执行此操作"


@pytest.mark.asyncio
async def test_delete_certificate_uses_soft_delete(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    create_response = await client.post(
        "/api/v1/certificates",
        json=_certificate_payload(
            name="待删除证书",
            certificate_no="CERT-012",
        ),
    )
    certificate_id = create_response.json()["id"]

    delete_response = await client.delete(f"/api/v1/certificates/{certificate_id}")
    list_response = await client.get("/api/v1/certificates")
    detail_response = await client.get(f"/api/v1/certificates/{certificate_id}")

    assert delete_response.status_code == 204
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 0
    assert detail_response.status_code == 404
    assert detail_response.json()["message"] == "证书不存在"
