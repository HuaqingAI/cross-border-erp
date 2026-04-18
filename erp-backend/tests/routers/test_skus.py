from __future__ import annotations

import uuid

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
    supplier_name: str,
    restricted_countries: list[str],
    customer_warranty_months: int = 24,
) -> dict:
    level1_id, level2_id, level3_id = category_ids
    return {
        "code": code,
        "name": name,
        "level1_category_id": level1_id,
        "level2_category_id": level2_id,
        "level3_category_id": level3_id,
        "customer_warranty_months": customer_warranty_months,
        "unit": "台",
        "restricted_countries": restricted_countries,
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
    supplier_name: str,
    restricted_countries: list[str],
    customer_warranty_months: int = 24,
) -> dict:
    category_ids = await _create_category_tree(client)
    response = await client.post(
        "/api/v1/spus",
        json=_spu_payload(
            code=code,
            name=name,
            category_ids=category_ids,
            supplier_name=supplier_name,
            restricted_countries=restricted_countries,
            customer_warranty_months=customer_warranty_months,
        ),
    )
    assert response.status_code == 201
    data = response.json()
    data["category_ids"] = category_ids
    return data


def _sku_payload(
    *,
    spu_id: int,
    code: str,
    name_zh: str,
    name_en: str,
    product_type: str = "主品",
    product_status: str | None = None,
    package_details: list[dict] | None = None,
) -> dict:
    payload = {
        "spu_id": spu_id,
        "code": code,
        "name_zh": name_zh,
        "name_en": name_en,
        "product_model": f"{code}-MODEL",
        "product_type": product_type,
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
        "package_details": package_details
        if package_details is not None
        else [
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
    if product_status is not None:
        payload["product_status"] = product_status
    return payload


@pytest.mark.asyncio
async def test_product_user_can_create_sku_with_spu_inheritance(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-SKU-001",
        name="彩超平台",
        supplier_name="供应商甲",
        restricted_countries=["US", "DE"],
        customer_warranty_months=24,
    )

    response = await client.post(
        "/api/v1/skus",
        json=_sku_payload(
            spu_id=spu["id"],
            code="SKU001",
            name_zh="彩超平台-标准版",
            name_en="Ultrasound Standard",
        ),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "SKU001"
    assert data["spu_id"] == spu["id"]
    assert data["spu_code"] == "SPU-SKU-001"
    assert data["supplier_name"] == "供应商甲"
    assert data["restricted_countries"] == ["US", "DE"]
    assert data["level1_category_id"] == spu["category_ids"][0]
    assert data["product_status"] == "上架"
    assert data["customer_warranty_months"] == 24
    assert data["customs_hscode"] is None
    assert data["customs_info_ready"] is False
    assert data["package_details"][0]["net_weight_kg"] == "1.200"


@pytest.mark.asyncio
async def test_create_sku_rejects_inherited_customer_warranty_write(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-SKU-002",
        name="监护仪平台",
        supplier_name="供应商乙",
        restricted_countries=["FR"],
        customer_warranty_months=18,
    )

    response = await client.post(
        "/api/v1/skus",
        json={
            **_sku_payload(
                spu_id=spu["id"],
                code="SKU002",
                name_zh="监护仪平台-高配",
                name_en="Monitor Premium",
            ),
            "customer_warranty_months": 36,
        },
    )

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_sku_code_must_be_unique(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-SKU-003",
        name="电刀平台",
        supplier_name="供应商丙",
        restricted_countries=[],
    )

    first = await client.post(
        "/api/v1/skus",
        json=_sku_payload(
            spu_id=spu["id"],
            code="SKU003",
            name_zh="电刀标准版",
            name_en="Knife Standard",
        ),
    )
    second = await client.post(
        "/api/v1/skus",
        json=_sku_payload(
            spu_id=spu["id"],
            code="SKU003",
            name_zh="电刀增强版",
            name_en="Knife Pro",
        ),
    )

    assert first.status_code == 201
    assert second.status_code == 400
    assert second.json()["message"] == "SKU编码已存在"


@pytest.mark.asyncio
async def test_cannot_update_sku_code(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-SKU-004",
        name="手术床平台",
        supplier_name="供应商丁",
        restricted_countries=["GB"],
    )
    create_response = await client.post(
        "/api/v1/skus",
        json=_sku_payload(
            spu_id=spu["id"],
            code="SKU004",
            name_zh="手术床标准版",
            name_en="Bed Standard",
        ),
    )
    sku_id = create_response.json()["id"]

    response = await client.patch(
        f"/api/v1/skus/{sku_id}",
        json={"code": "SKU004-NEW"},
    )

    assert response.status_code == 400
    assert response.json()["message"] == "SKU编码创建后不可修改"


@pytest.mark.asyncio
async def test_update_sku_can_switch_spu_and_reinherit_fields(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu_a = await _create_spu(
        client,
        code="SPU-SKU-005A",
        name="基础平台A",
        supplier_name="供应商A",
        restricted_countries=["US"],
        customer_warranty_months=12,
    )
    spu_b = await _create_spu(
        client,
        code="SPU-SKU-005B",
        name="基础平台B",
        supplier_name="供应商B",
        restricted_countries=["JP", "KR"],
        customer_warranty_months=48,
    )
    create_response = await client.post(
        "/api/v1/skus",
        json=_sku_payload(
            spu_id=spu_a["id"],
            code="SKU005",
            name_zh="平台A-SKU",
            name_en="Platform A SKU",
        ),
    )
    sku_id = create_response.json()["id"]

    response = await client.patch(
        f"/api/v1/skus/{sku_id}",
        json={
            "spu_id": spu_b["id"],
            "name_zh": "平台B-SKU",
            "package_details": [
                {
                    "net_weight_kg": "2.300",
                    "gross_weight_kg": "2.600",
                    "length_cm": "40.000",
                    "width_cm": "25.000",
                    "height_cm": "15.000",
                    "volume_cbm": "0.015",
                    "sort_order": 2,
                },
                {
                    "net_weight_kg": "1.100",
                    "gross_weight_kg": "1.400",
                    "length_cm": "20.000",
                    "width_cm": "15.000",
                    "height_cm": "10.000",
                    "volume_cbm": "0.003",
                    "sort_order": 1,
                },
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["spu_id"] == spu_b["id"]
    assert data["spu_code"] == "SPU-SKU-005B"
    assert data["supplier_name"] == "供应商B"
    assert data["restricted_countries"] == ["JP", "KR"]
    assert data["level1_category_id"] == spu_b["category_ids"][0]
    assert data["customer_warranty_months"] == 48
    assert [item["sort_order"] for item in data["package_details"]] == [1, 2]


@pytest.mark.asyncio
async def test_update_sku_rejects_inherited_customer_warranty_write(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-SKU-005C",
        name="平台C",
        supplier_name="供应商C",
        restricted_countries=["SG"],
        customer_warranty_months=24,
    )
    create_response = await client.post(
        "/api/v1/skus",
        json=_sku_payload(
            spu_id=spu["id"],
            code="SKU005C",
            name_zh="平台C-SKU",
            name_en="Platform C SKU",
        ),
    )
    sku_id = create_response.json()["id"]

    response = await client.patch(
        f"/api/v1/skus/{sku_id}",
        json={"customer_warranty_months": 36},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_package_details_without_sort_order_use_request_order(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-SKU-005D",
        name="平台D",
        supplier_name="供应商D",
        restricted_countries=[],
    )

    response = await client.post(
        "/api/v1/skus",
        json=_sku_payload(
            spu_id=spu["id"],
            code="SKU005D",
            name_zh="平台D-SKU",
            name_en="Platform D SKU",
            package_details=[
                {
                    "net_weight_kg": "2.100",
                    "gross_weight_kg": "2.300",
                },
                {
                    "net_weight_kg": "1.100",
                    "gross_weight_kg": "1.300",
                },
            ],
        ),
    )

    assert response.status_code == 201
    assert [item["sort_order"] for item in response.json()["package_details"]] == [0, 1]


@pytest.mark.asyncio
async def test_business_user_can_read_but_cannot_write_sku(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-SKU-006",
        name="注射泵平台",
        supplier_name="供应商戊",
        restricted_countries=[],
    )
    create_response = await client.post(
        "/api/v1/skus",
        json=_sku_payload(
            spu_id=spu["id"],
            code="SKU006",
            name_zh="注射泵标准版",
            name_en="Pump Standard",
        ),
    )
    sku_id = create_response.json()["id"]

    await _login_as_role(client, db_session, UserRole.BUSINESS_DEPT)
    list_response = await client.get("/api/v1/skus")
    detail_response = await client.get(f"/api/v1/skus/{sku_id}")
    write_response = await client.patch(
        f"/api/v1/skus/{sku_id}",
        json={"name_zh": "修改失败"},
    )

    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert write_response.status_code == 403
    assert write_response.json()["detail"] == "无权限执行此操作"
    assert detail_response.json()["customs_hscode"] is None


@pytest.mark.asyncio
async def test_business_user_can_update_customs_info(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-SKU-006B",
        name="报关平台",
        supplier_name="供应商己",
        restricted_countries=["US"],
    )
    create_response = await client.post(
        "/api/v1/skus",
        json=_sku_payload(
            spu_id=spu["id"],
            code="SKU006B",
            name_zh="报关平台标准版",
            name_en="Customs Standard",
        ),
    )
    sku_id = create_response.json()["id"]

    await _login_as_role(client, db_session, UserRole.BUSINESS_DEPT)
    update_response = await client.patch(
        f"/api/v1/skus/{sku_id}/customs-info",
        json={
            "customs_hscode": "90181234",
            "customs_supervision_condition": "A",
            "customs_declaration_elements": "医用超声设备",
            "customs_refund_tax_rate": "13.50",
            "customs_info_ready": True,
        },
    )

    assert update_response.status_code == 200
    data = update_response.json()
    assert data["customs_hscode"] == "90181234"
    assert data["customs_supervision_condition"] == "A"
    assert data["customs_declaration_elements"] == "医用超声设备"
    assert data["customs_refund_tax_rate"] == "13.50"
    assert data["customs_info_ready"] is True


@pytest.mark.asyncio
async def test_admin_can_update_customs_info(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-SKU-006C",
        name="报关平台管理员",
        supplier_name="供应商庚",
        restricted_countries=[],
    )
    create_response = await client.post(
        "/api/v1/skus",
        json=_sku_payload(
            spu_id=spu["id"],
            code="SKU006C",
            name_zh="报关平台管理员版",
            name_en="Admin Customs",
        ),
    )
    sku_id = create_response.json()["id"]

    await _login_as_role(client, db_session, UserRole.ADMIN)
    update_response = await client.patch(
        f"/api/v1/skus/{sku_id}/customs-info",
        json={"customs_info_ready": True},
    )

    assert update_response.status_code == 200
    assert update_response.json()["customs_info_ready"] is True


@pytest.mark.asyncio
async def test_product_user_cannot_update_customs_info_but_can_read_after_business_update(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(
        client,
        code="SPU-SKU-006D",
        name="报关平台只读",
        supplier_name="供应商辛",
        restricted_countries=["DE"],
    )
    create_response = await client.post(
        "/api/v1/skus",
        json=_sku_payload(
            spu_id=spu["id"],
            code="SKU006D",
            name_zh="报关平台只读版",
            name_en="Readonly Customs",
        ),
    )
    sku_id = create_response.json()["id"]

    await _login_as_role(client, db_session, UserRole.BUSINESS_DEPT)
    business_update = await client.patch(
        f"/api/v1/skus/{sku_id}/customs-info",
        json={
            "customs_hscode": "90221490",
            "customs_supervision_condition": "B",
            "customs_declaration_elements": "X光设备",
            "customs_refund_tax_rate": "9.00",
            "customs_info_ready": True,
        },
    )
    assert business_update.status_code == 200

    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    forbidden_response = await client.patch(
        f"/api/v1/skus/{sku_id}/customs-info",
        json={"customs_hscode": "00000000"},
    )
    detail_response = await client.get(f"/api/v1/skus/{sku_id}")

    assert forbidden_response.status_code == 403
    assert forbidden_response.json()["detail"] == "报关信息仅商务部可编辑"
    assert detail_response.status_code == 200
    assert detail_response.json()["customs_hscode"] == "90221490"
    assert detail_response.json()["customs_supervision_condition"] == "B"
    assert detail_response.json()["customs_declaration_elements"] == "X光设备"
    assert detail_response.json()["customs_refund_tax_rate"] == "9.00"
    assert detail_response.json()["customs_info_ready"] is True


@pytest.mark.asyncio
async def test_list_supports_spu_and_multi_filters(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu_a = await _create_spu(
        client,
        code="SPU-SKU-007A",
        name="超声平台A",
        supplier_name="供应商甲",
        restricted_countries=["US"],
    )
    spu_b = await _create_spu(
        client,
        code="SPU-SKU-007B",
        name="超声平台B",
        supplier_name="供应商乙",
        restricted_countries=["DE"],
    )

    await client.post(
        "/api/v1/skus",
        json=_sku_payload(
            spu_id=spu_a["id"],
            code="SKU007A",
            name_zh="超声刀 Alpha",
            name_en="Alpha Ultrasound",
            product_type="主品",
            product_status="上架",
        ),
    )
    await client.post(
        "/api/v1/skus",
        json=_sku_payload(
            spu_id=spu_b["id"],
            code="SKU007B",
            name_zh="耗材 Beta",
            name_en="Beta Consumable",
            product_type="耗材",
            product_status="下架不可售",
        ),
    )

    response = await client.get(
        "/api/v1/skus",
        params={
            "spu_id": spu_a["id"],
            "level1_category_id": spu_a["category_ids"][0],
            "supplier_name": "供应商甲",
            "product_status": "上架",
            "product_type": "主品",
            "keyword": "Alpha",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["code"] == "SKU007A"
