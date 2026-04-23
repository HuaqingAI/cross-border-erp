from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.storage import get_file_url
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
    await _seed_sku_enums(db_session)


async def _seed_enum(
    db_session: AsyncSession,
    *,
    enum_group: str,
    enum_key: str,
    sort_order: int = 0,
) -> None:
    existing = await db_session.scalar(
        select(SystemEnum).where(
            SystemEnum.enum_group == enum_group,
            SystemEnum.enum_key == enum_key,
            SystemEnum.deleted_at.is_(None),
        )
    )
    if existing is not None:
        existing.is_enabled = True
        existing.sort_order = sort_order
        db_session.add(existing)
        await db_session.commit()
        return

    db_session.add(
        SystemEnum(
            enum_group=enum_group,
            enum_key=enum_key,
            enum_value=enum_key,
            sort_order=sort_order,
            is_enabled=True,
        )
    )
    await db_session.commit()


async def _seed_sku_enums(db_session: AsyncSession) -> None:
    await _seed_enum(db_session, enum_group="product_type", enum_key="主品")
    await _seed_enum(db_session, enum_group="product_type", enum_key="耗材")
    await _seed_enum(db_session, enum_group="product_status", enum_key="上架")
    await _seed_enum(db_session, enum_group="product_status", enum_key="下架不可售")


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
        "supplier_name": "供应商A",
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
) -> dict:
    category_ids = await _create_category_tree(client)
    response = await client.post(
        "/api/v1/spus",
        json=_spu_payload(code=code, name=name, category_ids=category_ids),
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
    code: str,
    name_zh: str,
) -> dict:
    spu = await _create_spu(client, code=f"{code}-SPU", name=f"{name_zh}SPU")
    response = await client.post(
        "/api/v1/skus",
        json=_sku_payload(
            spu_id=spu["id"],
            code=code,
            name_zh=name_zh,
            name_en=f"{name_zh}EN",
        ),
    )
    assert response.status_code == 201
    data = response.json()
    data["spu"] = spu
    return data


def _attachment(filename: str, *, sort_order: int | None = None) -> dict:
    object_key = f"product-documents/{filename}"
    payload = {
        "object_key": object_key,
        "file_url": get_file_url(object_key),
        "file_name": filename,
    }
    if sort_order is not None:
        payload["sort_order"] = sort_order
    return payload


def _document_payload(
    *,
    name: str,
    document_type: str | None = "产品手册",
    content_html: str | None = "<p>资料正文</p>",
    ownership_type: str = "通用",
    sku_ids: list[int] | None = None,
    category_ids: list[int] | None = None,
    applicable_countries: list[str] | None = None,
    attachments: list[dict] | None = None,
) -> dict:
    return {
        "name": name,
        "document_type": document_type,
        "content_html": content_html,
        "ownership_type": ownership_type,
        "sku_ids": sku_ids or [],
        "category_ids": category_ids or [],
        "applicable_countries": applicable_countries or [],
        "attachments": attachments or [],
        "remarks": "产品资料备注",
    }


@pytest.mark.asyncio
async def test_product_user_can_create_general_document_with_content_only(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="通用产品手册",
            attachments=[],
            applicable_countries=["US", "DE", "US"],
        ),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "通用产品手册"
    assert data["ownership_type"] == "通用"
    assert data["ownership_summary"] == "通用（全部SKU）"
    assert data["sku_ids"] == []
    assert data["category_ids"] == []
    assert data["attachments"] == []
    assert data["applicable_countries"] == ["US", "DE"]


@pytest.mark.asyncio
async def test_create_document_rejects_blank_name(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="   ",
            attachments=[_attachment("blank-name.pdf")],
        ),
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_document_rejects_non_standard_country_code(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="非法国家资料",
            applicable_countries=["China"],
        ),
    )

    assert response.status_code == 400
    assert response.json()["message"] == "适用国家/地区必须为标准编码（如 CN、US、GLOBAL）"
    assert response.json()["code"] == "BUSINESS_ERROR"


@pytest.mark.asyncio
async def test_list_documents_supports_aggregate_filters(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    target_sku = await _create_sku(client, code="SKU-DOC-001", name_zh="目标SKU")
    other_sku = await _create_sku(client, code="SKU-DOC-002", name_zh="其他SKU")
    target_level3_id = target_sku["spu"]["category_ids"][2]
    other_level3_id = other_sku["spu"]["category_ids"][2]

    await client.post(
        "/api/v1/products/documents",
        json=_document_payload(name="通用资料"),
    )
    await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="目标SKU资料",
            ownership_type="指定SKU",
            sku_ids=[target_sku["id"]],
        ),
    )
    await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="目标分类资料",
            ownership_type="按分类",
            category_ids=[target_level3_id],
        ),
    )
    await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="其他SKU资料",
            ownership_type="指定SKU",
            sku_ids=[other_sku["id"]],
        ),
    )
    await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="其他分类资料",
            ownership_type="按分类",
            category_ids=[other_level3_id],
        ),
    )

    response = await client.get(
        "/api/v1/products/documents",
        params=[
            ("page", "1"),
            ("page_size", "100"),
            ("aggregate_sku_id", str(target_sku["id"])),
            ("aggregate_category_ids", str(target_sku["spu"]["category_ids"][0])),
            ("aggregate_category_ids", str(target_sku["spu"]["category_ids"][1])),
            ("aggregate_category_ids", str(target_sku["spu"]["category_ids"][2])),
        ],
    )

    assert response.status_code == 200
    names = {item["name"] for item in response.json()["items"]}
    assert names == {"通用资料", "目标SKU资料", "目标分类资料"}


@pytest.mark.asyncio
async def test_create_document_normalizes_optional_text_fields(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="  已修剪资料名  ",
            document_type="  安装说明  ",
            attachments=[_attachment("normalized.pdf")],
        ),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "已修剪资料名"
    assert data["document_type"] == "安装说明"


@pytest.mark.asyncio
async def test_product_user_can_create_sku_owned_document_with_attachments_only(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    sku_a = await _create_sku(client, code="SKU-DOC-001", name_zh="监护仪A")
    sku_b = await _create_sku(client, code="SKU-DOC-002", name_zh="监护仪B")

    response = await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="SKU专属安装说明",
            content_html=None,
            ownership_type="指定SKU",
            sku_ids=[sku_a["id"], sku_b["id"], sku_a["id"]],
            attachments=[_attachment("install-a.pdf"), _attachment("install-b.pdf")],
        ),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["ownership_type"] == "指定SKU"
    assert data["sku_ids"] == [sku_a["id"], sku_b["id"]]
    assert len(data["attachments"]) == 2
    assert data["attachments"][0]["sort_order"] == 0
    assert data["attachments"][1]["sort_order"] == 1


@pytest.mark.asyncio
async def test_document_requires_content_or_attachments(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="空资料",
            content_html="<p> &nbsp; </p>",
            attachments=[],
        ),
    )

    assert response.status_code == 400
    assert response.json()["message"] == "资料内容和资料文件至少填写一项"


@pytest.mark.asyncio
async def test_sku_ownership_requires_sku_ids(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="缺失SKU归属资料",
            ownership_type="指定SKU",
            sku_ids=[],
            attachments=[_attachment("sku-required.pdf")],
        ),
    )

    assert response.status_code == 400
    assert response.json()["message"] == "归属类型为'指定SKU'时，SKU 选择必填"


@pytest.mark.asyncio
async def test_category_ownership_requires_category_ids(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="缺失分类归属资料",
            ownership_type="按分类",
            category_ids=[],
            attachments=[_attachment("category-required.pdf")],
        ),
    )

    assert response.status_code == 400
    assert response.json()["message"] == "归属类型为'按分类'时，分类选择必填"


@pytest.mark.asyncio
async def test_product_user_can_create_category_owned_document(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    categories = await _create_category_tree(client)

    response = await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="分类技术参数",
            ownership_type="按分类",
            category_ids=[categories[2]],
            attachments=[_attachment("category-spec.pdf")],
        ),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["ownership_type"] == "按分类"
    assert data["category_ids"] == [categories[2]]
    assert data["categories"][0]["category_id"] == categories[2]


@pytest.mark.asyncio
async def test_attachment_url_must_match_object_key(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="附件非法资料",
            attachments=[
                {
                    "object_key": "product-documents/manual.pdf",
                    "file_url": "https://example.com/product-documents/manual.pdf",
                    "file_name": "manual.pdf",
                }
            ],
        ),
    )

    assert response.status_code == 400
    assert response.json()["message"] == "资料附件URL与对象键不匹配"


@pytest.mark.asyncio
async def test_product_user_can_update_document_attachments_and_ownership(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    sku = await _create_sku(client, code="SKU-DOC-003", name_zh="输注泵")

    create_response = await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="更新前资料",
            attachments=[_attachment("before.pdf")],
        ),
    )
    document_id = create_response.json()["id"]

    update_response = await client.patch(
        f"/api/v1/products/documents/{document_id}",
        json={
            "ownership_type": "指定SKU",
            "sku_ids": [sku["id"]],
            "attachments": [_attachment("after.pdf", sort_order=3)],
            "content_html": None,
            "applicable_countries": ["JP", "KR"],
        },
    )

    assert update_response.status_code == 200
    data = update_response.json()
    assert data["ownership_type"] == "指定SKU"
    assert data["sku_ids"] == [sku["id"]]
    assert data["attachments"][0]["file_name"] == "after.pdf"
    assert data["attachments"][0]["sort_order"] == 3
    assert data["applicable_countries"] == ["JP", "KR"]


@pytest.mark.asyncio
async def test_list_product_documents_supports_filters(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    manual = await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="彩超安装手册",
            document_type="安装说明",
            attachments=[_attachment("manual.pdf")],
        ),
    )
    faq_like = await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="彩超技术参数",
            document_type="技术参数",
            attachments=[_attachment("spec.pdf")],
        ),
    )

    assert manual.status_code == 201
    assert faq_like.status_code == 201

    response = await client.get(
        "/api/v1/products/documents",
        params={
            "document_type": "安装说明",
            "keyword": "安装",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "彩超安装手册"


@pytest.mark.asyncio
async def test_read_allowed_but_write_forbidden_for_business_user(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    create_response = await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="权限测试资料",
            attachments=[_attachment("permission.pdf")],
        ),
    )
    document_id = create_response.json()["id"]

    await _login_as_role(client, db_session, UserRole.BUSINESS_DEPT)
    get_response = await client.get(f"/api/v1/products/documents/{document_id}")
    patch_response = await client.patch(
        f"/api/v1/products/documents/{document_id}",
        json={"name": "不允许修改"},
    )

    assert get_response.status_code == 200
    assert patch_response.status_code == 403
    assert patch_response.json()["detail"] == "无权限执行此操作"


@pytest.mark.asyncio
async def test_delete_product_document_soft_deletes_record(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    create_response = await client.post(
        "/api/v1/products/documents",
        json=_document_payload(
            name="待删除资料",
            attachments=[_attachment("delete.pdf")],
        ),
    )
    document_id = create_response.json()["id"]

    delete_response = await client.delete(f"/api/v1/products/documents/{document_id}")
    list_response = await client.get("/api/v1/products/documents")
    detail_response = await client.get(f"/api/v1/products/documents/{document_id}")

    assert delete_response.status_code == 204
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 0
    assert detail_response.status_code == 404
