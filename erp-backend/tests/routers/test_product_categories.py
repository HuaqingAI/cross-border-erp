import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.product_category import ProductCategory
from app.models.spu import SPU
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


async def _create_category(
    client: AsyncClient,
    code: str,
    name: str,
    parent_id: int | None = None,
    sort_order: int | None = None,
):
    payload = {"code": code, "name": name}
    if parent_id is not None:
        payload["parent_id"] = parent_id
    if sort_order is not None:
        payload["sort_order"] = sort_order
    return await client.post("/api/v1/products/categories", json=payload)


async def _create_category_tree(
    client: AsyncClient,
    *,
    prefix: str,
) -> tuple[int, int, int]:
    root_id = (await _create_category(client, f"{prefix}-L1", "一级分类")).json()["id"]
    second_id = (
        await _create_category(client, f"{prefix}-L2", "二级分类", parent_id=root_id)
    ).json()["id"]
    third_id = (
        await _create_category(client, f"{prefix}-L3", "三级分类", parent_id=second_id)
    ).json()["id"]
    return root_id, second_id, third_id


@pytest.mark.asyncio
async def test_product_user_can_create_root_category(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    response = await _create_category(client, "ROOT001", "一级分类")

    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "ROOT001"
    assert data["level"] == 1
    assert data["parent_id"] is None
    assert data["sort_order"] == 1


@pytest.mark.asyncio
async def test_can_create_second_and_third_level_categories(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    root_resp = await _create_category(client, "ROOT002", "一级")
    root_id = root_resp.json()["id"]
    second_resp = await _create_category(client, "CHILD002", "二级", parent_id=root_id)
    second_id = second_resp.json()["id"]
    third_resp = await _create_category(client, "LEAF002", "三级", parent_id=second_id)

    assert second_resp.status_code == 201
    assert second_resp.json()["level"] == 2
    assert second_resp.json()["parent_id"] == root_id
    assert third_resp.status_code == 201
    assert third_resp.json()["level"] == 3
    assert third_resp.json()["parent_id"] == second_id


@pytest.mark.asyncio
async def test_cannot_create_fourth_level_category(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    root_id = (await _create_category(client, "ROOT003", "一级")).json()["id"]
    second_id = (await _create_category(client, "CHILD003", "二级", parent_id=root_id)).json()["id"]
    third_id = (await _create_category(client, "LEAF003", "三级", parent_id=second_id)).json()["id"]

    response = await _create_category(client, "LEVEL004", "四级", parent_id=third_id)

    assert response.status_code == 400
    assert response.json()["message"] == "三级分类下不可继续创建子分类"


@pytest.mark.asyncio
async def test_category_code_must_be_unique(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    first = await _create_category(client, "UNIQ001", "分类A")
    second = await _create_category(client, "UNIQ001", "分类B")

    assert first.status_code == 201
    assert second.status_code == 400
    assert second.json()["message"] == "分类编码已存在"


@pytest.mark.asyncio
async def test_deleted_category_code_can_be_reused(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    category_id = (await _create_category(client, "REUSE001", "旧分类")).json()["id"]
    delete_response = await client.delete(f"/api/v1/products/categories/{category_id}")
    recreate_response = await _create_category(client, "REUSE001", "新分类")

    assert delete_response.status_code == 200
    assert recreate_response.status_code == 201
    assert recreate_response.json()["code"] == "REUSE001"
    assert recreate_response.json()["name"] == "新分类"


@pytest.mark.asyncio
async def test_cannot_modify_category_code(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    category_id = (await _create_category(client, "IMMUT001", "不可改编码")).json()["id"]

    response = await client.patch(
        f"/api/v1/products/categories/{category_id}",
        json={"code": "IMMUT999", "name": "新名称"},
    )

    assert response.status_code == 400
    assert response.json()["message"] == "分类编码创建后不可修改"


@pytest.mark.asyncio
async def test_business_user_cannot_create_category(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.BUSINESS_DEPT)

    response = await _create_category(client, "BUS001", "商务只读")

    assert response.status_code == 403
    assert response.json()["detail"] == "无权限执行此操作"


@pytest.mark.asyncio
async def test_logged_in_readonly_user_can_read_tree(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    root_id = (await _create_category(client, "TREE001", "树根")).json()["id"]
    await _create_category(client, "TREE002", "树子节点", parent_id=root_id)

    await _login_as_role(client, db_session, UserRole.BUSINESS_DEPT)
    response = await client.get("/api/v1/products/categories/tree")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["code"] == "TREE001"
    assert data[0]["children"][0]["code"] == "TREE002"


@pytest.mark.asyncio
async def test_sort_endpoint_changes_tree_order(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    first_id = (await _create_category(client, "SORT001", "分类1", sort_order=20)).json()["id"]
    second_id = (await _create_category(client, "SORT002", "分类2", sort_order=10)).json()["id"]

    before = await client.get("/api/v1/products/categories/tree")
    assert [item["code"] for item in before.json()] == ["SORT002", "SORT001"]

    sort_resp = await client.patch(
        f"/api/v1/products/categories/{first_id}/sort",
        json={"sort_order": 5},
    )
    assert sort_resp.status_code == 200

    after = await client.get("/api/v1/products/categories/tree")
    assert [item["code"] for item in after.json()] == ["SORT001", "SORT002"]
    assert after.json()[0]["sort_order"] == 5
    assert second_id is not None


@pytest.mark.asyncio
async def test_delete_parent_category_cascades_to_children(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    root_id = (await _create_category(client, "DEL001", "父分类")).json()["id"]
    child_id = (await _create_category(client, "DEL002", "子分类", parent_id=root_id)).json()["id"]
    grandchild_id = (await _create_category(client, "DEL005", "孙分类", parent_id=child_id)).json()["id"]

    response = await client.delete(f"/api/v1/products/categories/{root_id}")

    assert response.status_code == 200
    assert response.json()["message"] == "删除成功"

    result = await db_session.execute(
        select(ProductCategory).where(ProductCategory.id.in_([root_id, child_id, grandchild_id]))
    )
    deleted_categories = result.scalars().all()
    assert len(deleted_categories) == 3
    assert all(category.deleted_at is not None for category in deleted_categories)


@pytest.mark.asyncio
async def test_delete_leaf_category_soft_deletes_record(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    category_id = (await _create_category(client, "DEL003", "叶子分类")).json()["id"]

    response = await client.delete(f"/api/v1/products/categories/{category_id}")

    assert response.status_code == 200
    assert response.json()["message"] == "删除成功"

    result = await db_session.execute(
        select(ProductCategory).where(ProductCategory.id == category_id)
    )
    category = result.scalar_one()
    assert category.deleted_at is not None


@pytest.mark.asyncio
async def test_cannot_delete_category_with_linked_spu(client: AsyncClient, db_session: AsyncSession):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    level1_id, level2_id, level3_id = await _create_category_tree(client, prefix="DEL004")

    db_session.add(
        SPU(
            code="SPU001",
            name="测试SPU",
            level1_category_id=level1_id,
            level2_category_id=level2_id,
            level3_category_id=level3_id,
            customer_warranty_months=12,
            unit="台",
            restricted_countries=[],
            supplier_name="供应商A",
            manufacturer_model="MODEL-1",
        )
    )
    await db_session.commit()

    response = await client.delete(f"/api/v1/products/categories/{level3_id}")

    assert response.status_code == 400
    assert response.json()["message"] == "该分类下已有产品关联，无法删除"


@pytest.mark.asyncio
async def test_cannot_delete_parent_category_when_descendant_has_linked_spu(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    root_id, child_id, grandchild_id = await _create_category_tree(client, prefix="DEL006")

    db_session.add(
        SPU(
            code="SPU002",
            name="测试SPU-父子分类",
            level1_category_id=root_id,
            level2_category_id=child_id,
            level3_category_id=grandchild_id,
            customer_warranty_months=12,
            unit="台",
            restricted_countries=[],
            supplier_name="供应商B",
            manufacturer_model="MODEL-2",
        )
    )
    await db_session.commit()

    response = await client.delete(f"/api/v1/products/categories/{root_id}")

    assert response.status_code == 400
    assert response.json()["message"] == "该分类下已有产品关联，无法删除"
