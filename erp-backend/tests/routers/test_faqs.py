from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.storage import get_file_url
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
    return response.json()


def _faq_payload(
    *,
    question: str,
    answer: str = "标准答案",
    spu_id: int | None = None,
    question_type: str | None = "售后",
    attachment: dict | None = None,
) -> dict:
    payload = {
        "question": question,
        "answer": answer,
        "question_type": question_type,
    }
    if spu_id is not None:
        payload["spu_id"] = spu_id
    if attachment is not None:
        payload.update(attachment)
    return payload


def _attachment(filename: str) -> dict:
    object_key = f"faqs/{filename}"
    return {
        "attachment_object_key": object_key,
        "attachment_file_url": get_file_url(object_key),
        "attachment_file_name": filename,
    }


@pytest.mark.asyncio
async def test_product_user_can_create_global_faq(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/faqs",
        json=_faq_payload(
            question="这个产品支持蓝牙吗？",
            attachment=_attachment("global.pdf"),
        ),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["spu_id"] is None
    assert data["scope_summary"] == "全局"
    assert data["attachment_file_name"] == "global.pdf"


@pytest.mark.asyncio
async def test_product_user_can_create_spu_faq(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(client, code="SPU-FAQ-001", name="监护平台")

    response = await client.post(
        "/api/v1/faqs",
        json=_faq_payload(
            question="这个 SPU 是否支持定制包装？",
            spu_id=spu["id"],
        ),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["spu_id"] == spu["id"]
    assert data["spu_code"] == spu["code"]
    assert data["spu_name"] == spu["name"]


@pytest.mark.asyncio
async def test_faq_question_max_length_validation(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/faqs",
        json=_faq_payload(question="问" * 201),
    )

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert response.json()["details"][0]["msg"] == "Value error, 问题最大 200 字"


@pytest.mark.asyncio
async def test_faq_spu_must_exist(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/faqs",
        json=_faq_payload(question="不存在的SPU", spu_id=9999),
    )

    assert response.status_code == 404
    assert response.json()["message"] == "SPU不存在"


@pytest.mark.asyncio
async def test_faq_attachment_url_must_match_object_key(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await client.post(
        "/api/v1/faqs",
        json=_faq_payload(
            question="附件非法 FAQ",
            attachment={
                "attachment_object_key": "faqs/demo.pdf",
                "attachment_file_url": "https://example.com/faqs/demo.pdf",
                "attachment_file_name": "demo.pdf",
            },
        ),
    )

    assert response.status_code == 400
    assert response.json()["message"] == "FAQ附件URL与对象键不匹配"


@pytest.mark.asyncio
async def test_list_faqs_supports_filters(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    spu = await _create_spu(client, code="SPU-FAQ-002", name="输注平台")

    first = await client.post(
        "/api/v1/faqs",
        json=_faq_payload(
            question="安装完成后如何开机？",
            question_type="安装",
            spu_id=spu["id"],
        ),
    )
    second = await client.post(
        "/api/v1/faqs",
        json=_faq_payload(
            question="售后保修期多久？",
            answer="如需开机指导请联系客服",
            question_type="售后",
        ),
    )

    assert first.status_code == 201
    assert second.status_code == 201

    response = await client.get(
        "/api/v1/faqs",
        params={"spu_id": spu["id"], "question_type": "安装", "keyword": "开机"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["question"] == "安装完成后如何开机？"


@pytest.mark.asyncio
async def test_patch_can_clear_attachment_group_with_single_null_field(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    create_response = await client.post(
        "/api/v1/faqs",
        json=_faq_payload(
            question="附件清除 FAQ",
            attachment=_attachment("clear-me.pdf"),
        ),
    )
    faq_id = create_response.json()["id"]

    response = await client.patch(
        f"/api/v1/faqs/{faq_id}",
        json={"attachment_object_key": None},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["attachment_object_key"] is None
    assert data["attachment_file_url"] is None
    assert data["attachment_file_name"] is None


@pytest.mark.asyncio
async def test_business_user_can_read_but_cannot_write_faq(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    create_response = await client.post(
        "/api/v1/faqs",
        json=_faq_payload(question="权限测试 FAQ"),
    )
    faq_id = create_response.json()["id"]

    await _login_as_role(client, db_session, UserRole.BUSINESS_DEPT)
    get_response = await client.get(f"/api/v1/faqs/{faq_id}")
    patch_response = await client.patch(
        f"/api/v1/faqs/{faq_id}",
        json={"answer": "不允许修改"},
    )

    assert get_response.status_code == 200
    assert patch_response.status_code == 403
    assert patch_response.json()["detail"] == "无权限执行此操作"


@pytest.mark.asyncio
async def test_delete_faq_soft_deletes_record(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    create_response = await client.post(
        "/api/v1/faqs",
        json=_faq_payload(question="待删除 FAQ"),
    )
    faq_id = create_response.json()["id"]

    delete_response = await client.delete(f"/api/v1/faqs/{faq_id}")
    list_response = await client.get("/api/v1/faqs")
    detail_response = await client.get(f"/api/v1/faqs/{faq_id}")

    assert delete_response.status_code == 204
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 0
    assert detail_response.status_code == 404
