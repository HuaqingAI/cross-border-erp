from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.audit_log import AuditLog
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


async def _create_category_tree(client: AsyncClient, prefix: str) -> tuple[dict, dict, dict]:
    root = await client.post(
        "/api/v1/products/categories",
        json={"code": f"{prefix}-L1-{uuid.uuid4().hex[:4]}", "name": "一级分类"},
    )
    level1 = root.json()
    second = await client.post(
        "/api/v1/products/categories",
        json={
            "code": f"{prefix}-L2-{uuid.uuid4().hex[:4]}",
            "name": "二级分类",
            "parent_id": level1["id"],
        },
    )
    level2 = second.json()
    third = await client.post(
        "/api/v1/products/categories",
        json={
            "code": f"{prefix}-L3-{uuid.uuid4().hex[:4]}",
            "name": "三级分类",
            "parent_id": level2["id"],
        },
    )
    level3 = third.json()
    return level1, level2, level3


def _spu_payload(
    *,
    code: str,
    name: str,
    categories: tuple[dict, dict, dict],
    supplier_name: str,
    purchase_price: str = "188.00",
) -> dict:
    level1, level2, level3 = categories
    return {
        "code": code,
        "name": name,
        "level1_category_id": level1["id"],
        "level2_category_id": level2["id"],
        "level3_category_id": level3["id"],
        "customer_warranty_months": 24,
        "unit": "台",
        "restricted_countries": ["US", "DE"],
        "supplier_name": supplier_name,
        "manufacturer_model": f"{name}-MODEL",
        "purchase_price": purchase_price,
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
    prefix: str,
    supplier_name: str,
    purchase_price: str = "188.00",
) -> dict:
    categories = await _create_category_tree(client, prefix)
    response = await client.post(
        "/api/v1/spus",
        json=_spu_payload(
            code=code,
            name=name,
            categories=categories,
            supplier_name=supplier_name,
            purchase_price=purchase_price,
        ),
    )
    assert response.status_code == 201
    data = response.json()
    data["categories"] = categories
    return data


def _sku_payload(
    *,
    spu_id: int,
    code: str,
    name_zh: str,
    name_en: str,
) -> dict:
    return {
        "spu_id": spu_id,
        "code": code,
        "name_zh": name_zh,
        "name_en": name_en,
        "product_model": f"{code}-MODEL",
        "product_type": "主品",
        "core_params": "核心参数A",
        "principle": "工作原理A",
        "usage": "临床用途A",
        "material": "ABS",
        "unit": "台",
        "has_plug": True,
        "is_special": False,
        "special_notes": None,
        "package_type": "纸箱",
        "package_quantity": 2,
        "package_details": [
            {
                "net_weight_kg": "1.200",
                "gross_weight_kg": "1.500",
                "length_cm": "10.000",
                "width_cm": "20.000",
                "height_cm": "30.000",
                "volume_cbm": "0.006",
                "sort_order": 1,
            }
        ],
    }


async def _create_sku(
    client: AsyncClient,
    *,
    spu_id: int,
    code: str,
    name_zh: str,
    name_en: str,
) -> dict:
    response = await client.post(
        "/api/v1/skus",
        json=_sku_payload(
            spu_id=spu_id,
            code=code,
            name_zh=name_zh,
            name_en=name_en,
        ),
    )
    assert response.status_code == 201
    return response.json()


def _price_payload(*, sku_id: int, regions: list[dict]) -> dict:
    return {"sku_id": sku_id, "regions": regions}


def _region(
    *,
    country_code: str = "GLOBAL",
    country_name: str = "全球",
    currency: str = "USD",
    sale_price: str = "199.00",
    list_price: str = "299.00",
    remarks: str | None = None,
    sort_order: int | None = None,
) -> dict:
    payload = {
        "country_code": country_code,
        "country_name": country_name,
        "currency": currency,
        "sale_price": sale_price,
        "list_price": list_price,
    }
    if remarks is not None:
        payload["remarks"] = remarks
    if sort_order is not None:
        payload["sort_order"] = sort_order
    return payload


@pytest.mark.asyncio
async def test_finance_user_can_create_price_with_snapshot_and_multiple_regions(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-PRICE-001",
        name="输注平台",
        prefix="PRICE1",
        supplier_name="供应商甲",
        purchase_price="268.00",
    )
    sku = await _create_sku(
        client,
        spu_id=spu["id"],
        code="SKU-PRICE-001",
        name_zh="输注平台标准版",
        name_en="Infusion Standard",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    response = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku["id"],
            regions=[
                _region(),
                _region(
                    country_code="DE",
                    country_name="德国",
                    currency="EUR",
                    sale_price="219.00",
                    list_price="319.00",
                    sort_order=1,
                ),
            ],
        ),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["sku_id"] == sku["id"]
    assert data["sku_code"] == sku["code"]
    assert data["sku_name_zh"] == sku["name_zh"]
    assert data["spu_id"] == spu["id"]
    assert data["spu_code"] == spu["code"]
    assert data["spu_name"] == spu["name"]
    assert data["supplier_name"] == "供应商甲"
    assert data["purchase_price"] == "268.00"
    assert data["product_model"] == "SKU-PRICE-001-MODEL"
    assert data["product_status"] == "上架"
    assert data["level1_category_name"] == "一级分类"
    assert len(data["regions"]) == 2
    assert data["regions"][0]["country_code"] == "GLOBAL"
    assert data["regions"][1]["country_code"] == "DE"


@pytest.mark.asyncio
async def test_price_rejects_duplicate_regions_in_single_request(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-PRICE-002",
        name="监护平台",
        prefix="PRICE2",
        supplier_name="供应商乙",
    )
    sku = await _create_sku(
        client,
        spu_id=spu["id"],
        code="SKU-PRICE-002",
        name_zh="监护平台专业版",
        name_en="Monitor Pro",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    response = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku["id"],
            regions=[
                _region(country_code="US", country_name="美国"),
                _region(country_code="US", country_name="美国"),
            ],
        ),
    )

    assert response.status_code == 400
    assert response.json()["message"] == "同一 SKU 同一国家/地区不可重复设置价格"


@pytest.mark.asyncio
async def test_price_rejects_duplicate_region_across_same_sku(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-PRICE-003",
        name="手术灯平台",
        prefix="PRICE3",
        supplier_name="供应商丙",
    )
    sku = await _create_sku(
        client,
        spu_id=spu["id"],
        code="SKU-PRICE-003",
        name_zh="手术灯标准版",
        name_en="Light Standard",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    first = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku["id"],
            regions=[_region(country_code="US", country_name="美国")],
        ),
    )
    second = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku["id"],
            regions=[_region(country_code="US", country_name="美国", sale_price="209.00", list_price="309.00")],
        ),
    )

    assert first.status_code == 201
    assert second.status_code == 400
    assert second.json()["message"] == "该SKU已存在价格记录"


@pytest.mark.asyncio
async def test_product_user_can_read_but_cannot_write_price(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-PRICE-004",
        name="彩超平台",
        prefix="PRICE4",
        supplier_name="供应商丁",
    )
    sku = await _create_sku(
        client,
        spu_id=spu["id"],
        code="SKU-PRICE-004",
        name_zh="彩超平台经典版",
        name_en="Ultrasound Classic",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    create_response = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku["id"],
            regions=[_region()],
        ),
    )
    price_id = create_response.json()["id"]

    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    get_response = await client.get(f"/api/v1/prices/{price_id}")
    patch_response = await client.patch(
        f"/api/v1/prices/{price_id}",
        json={"regions": [_region(country_code="DE", country_name="德国")]},
    )

    assert get_response.status_code == 200
    assert get_response.json()["sku_code"] == "SKU-PRICE-004"
    assert get_response.json()["regions"] == []
    assert patch_response.status_code == 403
    assert patch_response.json()["detail"] == "无权限执行此操作"


@pytest.mark.asyncio
async def test_business_user_can_read_price_but_not_full_detail(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-PRICE-004B",
        name="彩超平台B",
        prefix="PRICE4B",
        supplier_name="供应商戊",
    )
    sku = await _create_sku(
        client,
        spu_id=spu["id"],
        code="SKU-PRICE-004B",
        name_zh="彩超平台商务隔离版",
        name_en="Ultrasound Hidden",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    create_response = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku["id"],
            regions=[_region()],
        ),
    )
    price_id = create_response.json()["id"]

    await _login_as_role(client, db_session, UserRole.BUSINESS_DEPT)
    detail_response = await client.get(f"/api/v1/prices/{price_id}")
    list_response = await client.get("/api/v1/prices")

    assert detail_response.status_code == 200
    detail_data = detail_response.json()
    assert detail_data["sku_code"] == "SKU-PRICE-004B"
    assert detail_data["purchase_price"] is None
    assert detail_data["regions"] == []

    assert list_response.status_code == 200
    list_data = list_response.json()
    assert list_data["total"] >= 1
    matched_item = next(item for item in list_data["items"] if item["id"] == price_id)
    assert matched_item["sku_code"] == "SKU-PRICE-004B"
    assert matched_item["purchase_price"] is None


@pytest.mark.asyncio
async def test_list_prices_supports_filters(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    first_spu = await _create_spu(
        client,
        code="SPU-PRICE-005A",
        name="基础平台A",
        prefix="PRICE5A",
        supplier_name="供应商A",
    )
    second_spu = await _create_spu(
        client,
        code="SPU-PRICE-005B",
        name="基础平台B",
        prefix="PRICE5B",
        supplier_name="供应商B",
    )
    first_sku = await _create_sku(
        client,
        spu_id=first_spu["id"],
        code="SKU-PRICE-005A",
        name_zh="基础平台A-标准版",
        name_en="Base A",
    )
    second_sku = await _create_sku(
        client,
        spu_id=second_spu["id"],
        code="SKU-PRICE-005B",
        name_zh="基础平台B-增强版",
        name_en="Base B",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    first_price = await client.post(
        "/api/v1/prices",
        json=_price_payload(sku_id=first_sku["id"], regions=[_region()]),
    )
    second_price = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=second_sku["id"],
            regions=[_region(country_code="DE", country_name="德国")],
        ),
    )

    assert first_price.status_code == 201
    assert second_price.status_code == 201

    response = await client.get(
        "/api/v1/prices",
        params={
            "sku_id": first_sku["id"],
            "supplier_name": "供应商A",
            "level1_category_id": first_spu["categories"][0]["id"],
            "keyword": "标准版",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["sku_code"] == "SKU-PRICE-005A"


@pytest.mark.asyncio
async def test_patch_price_can_switch_sku_and_replace_regions(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu_a = await _create_spu(
        client,
        code="SPU-PRICE-006A",
        name="平台A",
        prefix="PRICE6A",
        supplier_name="供应商A",
    )
    spu_b = await _create_spu(
        client,
        code="SPU-PRICE-006B",
        name="平台B",
        prefix="PRICE6B",
        supplier_name="供应商B",
    )
    sku_a = await _create_sku(
        client,
        spu_id=spu_a["id"],
        code="SKU-PRICE-006A",
        name_zh="平台A-标准版",
        name_en="Platform A",
    )
    sku_b = await _create_sku(
        client,
        spu_id=spu_b["id"],
        code="SKU-PRICE-006B",
        name_zh="平台B-升级版",
        name_en="Platform B",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    create_response = await client.post(
        "/api/v1/prices",
        json=_price_payload(sku_id=sku_a["id"], regions=[_region()]),
    )
    price_id = create_response.json()["id"]

    response = await client.patch(
        f"/api/v1/prices/{price_id}",
        json={
            "sku_id": sku_b["id"],
            "regions": [
                _region(
                    country_code="JP",
                    country_name="日本",
                    currency="JPY",
                    sale_price="30000.00",
                    list_price="36000.00",
                )
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["sku_id"] == sku_b["id"]
    assert data["sku_code"] == "SKU-PRICE-006B"
    assert data["supplier_name"] == "供应商B"
    assert len(data["regions"]) == 1
    assert data["regions"][0]["country_code"] == "JP"


@pytest.mark.asyncio
async def test_patch_price_can_replace_same_country_region_on_same_price(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-PRICE-006E",
        name="平台E",
        prefix="PRICE6E",
        supplier_name="供应商E",
    )
    sku = await _create_sku(
        client,
        spu_id=spu["id"],
        code="SKU-PRICE-006E",
        name_zh="平台E-标准版",
        name_en="Platform E",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    create_response = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku["id"],
            regions=[
                _region(
                    country_code="DE",
                    country_name="德国",
                    sale_price="200.00",
                    list_price="300.00",
                )
            ],
        ),
    )
    price_id = create_response.json()["id"]

    response = await client.patch(
        f"/api/v1/prices/{price_id}",
        json={
            "regions": [
                _region(
                    country_code="DE",
                    country_name="德国",
                    sale_price="260.00",
                    list_price="360.00",
                )
            ]
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["regions"]) == 1
    assert data["regions"][0]["country_code"] == "DE"
    assert data["regions"][0]["sale_price"] == "260.00"
    assert data["regions"][0]["list_price"] == "360.00"


@pytest.mark.asyncio
async def test_patch_price_rejects_switching_to_sku_with_existing_price(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu_a = await _create_spu(
        client,
        code="SPU-PRICE-006C",
        name="平台C",
        prefix="PRICE6C",
        supplier_name="供应商C",
    )
    spu_b = await _create_spu(
        client,
        code="SPU-PRICE-006D",
        name="平台D",
        prefix="PRICE6D",
        supplier_name="供应商D",
    )
    sku_a = await _create_sku(
        client,
        spu_id=spu_a["id"],
        code="SKU-PRICE-006C",
        name_zh="平台C-标准版",
        name_en="Platform C",
    )
    sku_b = await _create_sku(
        client,
        spu_id=spu_b["id"],
        code="SKU-PRICE-006D",
        name_zh="平台D-升级版",
        name_en="Platform D",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    first_create = await client.post(
        "/api/v1/prices",
        json=_price_payload(sku_id=sku_a["id"], regions=[_region()]),
    )
    second_create = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku_b["id"],
            regions=[_region(country_code="DE", country_name="德国")],
        ),
    )

    assert first_create.status_code == 201
    assert second_create.status_code == 201

    response = await client.patch(
        f"/api/v1/prices/{first_create.json()['id']}",
        json={
            "sku_id": sku_b["id"],
            "regions": [_region(country_code="JP", country_name="日本")],
        },
    )

    assert response.status_code == 400
    assert response.json()["message"] == "该SKU已存在价格记录"


@pytest.mark.asyncio
async def test_submit_and_approve_price_records_audit_logs(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-PRICE-008",
        name="审批平台",
        prefix="PRICE8",
        supplier_name="供应商审",
    )
    sku = await _create_sku(
        client,
        spu_id=spu["id"],
        code="SKU-PRICE-008",
        name_zh="审批平台标准版",
        name_en="Approval Platform",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    create_response = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku["id"],
            regions=[_region(country_code="US", country_name="美国")],
        ),
    )
    price_id = create_response.json()["id"]
    assert create_response.json()["approval_status"] == "草稿"

    submit_response = await client.post(f"/api/v1/prices/{price_id}/submit")
    assert submit_response.status_code == 200
    assert submit_response.json()["approval_status"] == "待审批"
    assert submit_response.json()["submitted_by"] is not None

    await _login_as_role(client, db_session, UserRole.ADMIN)
    approve_response = await client.post(f"/api/v1/prices/{price_id}/approve")
    assert approve_response.status_code == 200
    assert approve_response.json()["approval_status"] == "已生效"
    assert approve_response.json()["approved_by"] is not None
    assert approve_response.json()["regions"][0]["country_code"] == "US"

    result = await db_session.execute(
        select(AuditLog.action).where(
            AuditLog.entity_type == "price",
            AuditLog.entity_id == price_id,
        )
    )
    actions = [row[0] for row in result.all()]
    assert "submit_price" in actions
    assert "approve_price" in actions


@pytest.mark.asyncio
async def test_effective_price_keeps_previous_approved_regions_while_pending(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-PRICE-009",
        name="生效平台",
        prefix="PRICE9",
        supplier_name="供应商效",
    )
    sku = await _create_sku(
        client,
        spu_id=spu["id"],
        code="SKU-PRICE-009",
        name_zh="生效平台标准版",
        name_en="Effective Platform",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    create_response = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku["id"],
            regions=[_region(country_code="US", country_name="美国", sale_price="210.00", list_price="310.00")],
        ),
    )
    price_id = create_response.json()["id"]
    await client.post(f"/api/v1/prices/{price_id}/submit")

    await _login_as_role(client, db_session, UserRole.ADMIN)
    approve_initial = await client.post(f"/api/v1/prices/{price_id}/approve")
    assert approve_initial.status_code == 200

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    patch_response = await client.patch(
        f"/api/v1/prices/{price_id}",
        json={
            "regions": [
                _region(
                    country_code="US",
                    country_name="美国",
                    sale_price="260.00",
                    list_price="360.00",
                )
            ]
        },
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["approval_status"] == "草稿"
    assert patch_response.json()["regions"][0]["sale_price"] == "260.00"

    submit_response = await client.post(f"/api/v1/prices/{price_id}/submit")
    assert submit_response.status_code == 200
    assert submit_response.json()["approval_status"] == "待审批"

    await _login_as_role(client, db_session, UserRole.ADMIN)
    effective_response = await client.get(f"/api/v1/prices/sku/{sku['id']}/effective")
    assert effective_response.status_code == 200
    assert effective_response.json()["approval_status"] == "已生效"
    assert effective_response.json()["rejection_reason"] is None
    assert effective_response.json()["submitted_by"] is None
    assert effective_response.json()["approved_by"] is None
    assert effective_response.json()["rejected_by"] is None
    assert effective_response.json()["regions"][0]["sale_price"] == "210.00"
    assert effective_response.json()["regions"][0]["list_price"] == "310.00"

    approve_new = await client.post(f"/api/v1/prices/{price_id}/approve")
    assert approve_new.status_code == 200
    assert approve_new.json()["approval_status"] == "已生效"

    effective_after = await client.get(f"/api/v1/prices/sku/{sku['id']}/effective")
    assert effective_after.status_code == 200
    assert effective_after.json()["approval_status"] == "已生效"
    assert effective_after.json()["regions"][0]["sale_price"] == "260.00"
    assert effective_after.json()["regions"][0]["list_price"] == "360.00"


@pytest.mark.asyncio
async def test_editing_active_price_resets_previous_approval_metadata(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-PRICE-009D",
        name="元数据平台",
        prefix="PRICE9D",
        supplier_name="供应商元",
    )
    sku = await _create_sku(
        client,
        spu_id=spu["id"],
        code="SKU-PRICE-009D",
        name_zh="元数据平台标准版",
        name_en="Metadata Platform",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    create_response = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku["id"],
            regions=[_region(country_code="US", country_name="美国", sale_price="200.00", list_price="300.00")],
        ),
    )
    price_id = create_response.json()["id"]
    await client.post(f"/api/v1/prices/{price_id}/submit")

    await _login_as_role(client, db_session, UserRole.ADMIN)
    approve_response = await client.post(f"/api/v1/prices/{price_id}/approve")
    assert approve_response.status_code == 200
    assert approve_response.json()["approved_by"] is not None
    assert approve_response.json()["approved_at"] is not None

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    patch_response = await client.patch(
        f"/api/v1/prices/{price_id}",
        json={
            "regions": [
                _region(
                    country_code="US",
                    country_name="美国",
                    sale_price="230.00",
                    list_price="330.00",
                )
            ]
        },
    )

    assert patch_response.status_code == 200
    data = patch_response.json()
    assert data["approval_status"] == "草稿"
    assert data["submitted_at"] is None
    assert data["submitted_by"] is None
    assert data["approved_at"] is None
    assert data["approved_by"] is None
    assert data["rejected_at"] is None
    assert data["rejected_by"] is None
    assert data["rejection_reason"] is None


@pytest.mark.asyncio
async def test_price_list_supports_approval_status_filter(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-PRICE-009E",
        name="状态筛选平台",
        prefix="PRICE9E",
        supplier_name="供应商筛",
    )
    sku = await _create_sku(
        client,
        spu_id=spu["id"],
        code="SKU-PRICE-009E",
        name_zh="状态筛选平台标准版",
        name_en="Status Filter Platform",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    create_response = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku["id"],
            regions=[_region(country_code="JP", country_name="日本", sale_price="205.00", list_price="305.00")],
        ),
    )
    assert create_response.status_code == 201
    price_id = create_response.json()["id"]

    submit_response = await client.post(f"/api/v1/prices/{price_id}/submit")
    assert submit_response.status_code == 200

    pending_list_response = await client.get(
        "/api/v1/prices",
        params={"approval_status": "待审批"},
    )
    assert pending_list_response.status_code == 200
    pending_items = pending_list_response.json()["items"]
    assert any(item["id"] == price_id for item in pending_items)

    rejected_list_response = await client.get(
        "/api/v1/prices",
        params={"approval_status": "已驳回"},
    )
    assert rejected_list_response.status_code == 200
    rejected_items = rejected_list_response.json()["items"]
    assert all(item["id"] != price_id for item in rejected_items)


@pytest.mark.asyncio
async def test_business_user_can_read_effective_regions_but_not_purchase_price(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-PRICE-009C",
        name="只读生效平台",
        prefix="PRICE9C",
        supplier_name="供应商读",
    )
    sku = await _create_sku(
        client,
        spu_id=spu["id"],
        code="SKU-PRICE-009C",
        name_zh="只读生效平台标准版",
        name_en="Readonly Effective Platform",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    create_response = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku["id"],
            regions=[_region(country_code="DE", country_name="德国", sale_price="220.00", list_price="320.00")],
        ),
    )
    price_id = create_response.json()["id"]
    await client.post(f"/api/v1/prices/{price_id}/submit")

    await _login_as_role(client, db_session, UserRole.ADMIN)
    approve_response = await client.post(f"/api/v1/prices/{price_id}/approve")
    assert approve_response.status_code == 200

    await _login_as_role(client, db_session, UserRole.BUSINESS_DEPT)
    effective_response = await client.get(f"/api/v1/prices/sku/{sku['id']}/effective")
    assert effective_response.status_code == 200
    data = effective_response.json()
    assert data["approval_status"] == "已生效"
    assert data["purchase_price"] is None
    assert len(data["regions"]) == 1
    assert data["regions"][0]["country_code"] == "DE"
    assert data["regions"][0]["sale_price"] == "220.00"
    assert data["regions"][0]["list_price"] == "320.00"


@pytest.mark.asyncio
async def test_effective_price_returns_404_when_no_approved_version_exists(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-PRICE-009B",
        name="未生效平台",
        prefix="PRICE9B",
        supplier_name="供应商未",
    )
    sku = await _create_sku(
        client,
        spu_id=spu["id"],
        code="SKU-PRICE-009B",
        name_zh="未生效平台标准版",
        name_en="No Effective Platform",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    create_response = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku["id"],
            regions=[_region(country_code="US", country_name="美国", sale_price="210.00", list_price="310.00")],
        ),
    )
    price_id = create_response.json()["id"]

    draft_effective = await client.get(f"/api/v1/prices/sku/{sku['id']}/effective")
    assert draft_effective.status_code == 404
    assert draft_effective.json()["message"] == "暂无已生效价格"

    await client.post(f"/api/v1/prices/{price_id}/submit")
    await _login_as_role(client, db_session, UserRole.ADMIN)
    reject_response = await client.post(
        f"/api/v1/prices/{price_id}/reject",
        json={"reason": "价格依据不足"},
    )
    assert reject_response.status_code == 200

    rejected_effective = await client.get(f"/api/v1/prices/sku/{sku['id']}/effective")
    assert rejected_effective.status_code == 404
    assert rejected_effective.json()["message"] == "暂无已生效价格"


@pytest.mark.asyncio
async def test_reject_price_allows_edit_and_resubmit(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-PRICE-010",
        name="驳回平台",
        prefix="PRICE10",
        supplier_name="供应商驳",
    )
    sku = await _create_sku(
        client,
        spu_id=spu["id"],
        code="SKU-PRICE-010",
        name_zh="驳回平台标准版",
        name_en="Reject Platform",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    create_response = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku["id"],
            regions=[_region(country_code="DE", country_name="德国", sale_price="180.00", list_price="280.00")],
        ),
    )
    price_id = create_response.json()["id"]
    await client.post(f"/api/v1/prices/{price_id}/submit")

    await _login_as_role(client, db_session, UserRole.ADMIN)
    reject_response = await client.post(
        f"/api/v1/prices/{price_id}/reject",
        json={"reason": "价格依据不足"},
    )
    assert reject_response.status_code == 200
    assert reject_response.json()["approval_status"] == "已驳回"
    assert reject_response.json()["rejection_reason"] == "价格依据不足"

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    patch_response = await client.patch(
        f"/api/v1/prices/{price_id}",
        json={
            "regions": [
                _region(
                    country_code="DE",
                    country_name="德国",
                    sale_price="185.00",
                    list_price="285.00",
                )
            ]
        },
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["approval_status"] == "已驳回"
    assert patch_response.json()["regions"][0]["sale_price"] == "185.00"

    resubmit_response = await client.post(f"/api/v1/prices/{price_id}/submit")
    assert resubmit_response.status_code == 200
    assert resubmit_response.json()["approval_status"] == "待审批"
    assert resubmit_response.json()["rejection_reason"] is None


@pytest.mark.asyncio
async def test_finance_user_cannot_approve_or_reject_price(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-PRICE-011",
        name="权限平台",
        prefix="PRICE11",
        supplier_name="供应商权",
    )
    sku = await _create_sku(
        client,
        spu_id=spu["id"],
        code="SKU-PRICE-011",
        name_zh="权限平台标准版",
        name_en="Permission Platform",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    create_response = await client.post(
        "/api/v1/prices",
        json=_price_payload(
            sku_id=sku["id"],
            regions=[_region()],
        ),
    )
    price_id = create_response.json()["id"]
    await client.post(f"/api/v1/prices/{price_id}/submit")

    approve_response = await client.post(f"/api/v1/prices/{price_id}/approve")
    reject_response = await client.post(
        f"/api/v1/prices/{price_id}/reject",
        json={"reason": "无权限"},
    )

    assert approve_response.status_code == 403
    assert reject_response.status_code == 403


@pytest.mark.asyncio
async def test_delete_price_soft_deletes_record(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-PRICE-007",
        name="删除平台",
        prefix="PRICE7",
        supplier_name="供应商删",
    )
    sku = await _create_sku(
        client,
        spu_id=spu["id"],
        code="SKU-PRICE-007",
        name_zh="删除平台标准版",
        name_en="Delete Platform",
    )

    await _login_as_role(client, db_session, UserRole.FINANCE_DEPT)
    create_response = await client.post(
        "/api/v1/prices",
        json=_price_payload(sku_id=sku["id"], regions=[_region()]),
    )
    price_id = create_response.json()["id"]

    delete_response = await client.delete(f"/api/v1/prices/{price_id}")
    list_response = await client.get("/api/v1/prices")
    detail_response = await client.get(f"/api/v1/prices/{price_id}")

    assert delete_response.status_code == 204
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 0
    assert detail_response.status_code == 404
