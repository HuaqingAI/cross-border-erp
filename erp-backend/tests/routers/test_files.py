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


@pytest.mark.asyncio
async def test_product_user_can_get_presigned_upload_url(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)

    async def fake_create_presigned_upload(*, filename: str, content_type: str, folder: str):
        assert filename == "sku-image.png"
        assert content_type == "image/png"
        assert folder == "sku-images"
        return (
            "http://minio/presigned-upload",
            "sku-images/test-key.png",
            "http://localhost:9000/erp-sku-images/sku-images/test-key.png",
        )

    monkeypatch.setattr(
        "app.services.files.create_presigned_upload",
        fake_create_presigned_upload,
    )

    response = await client.post(
        "/api/v1/files/presigned-url",
        json={
            "filename": "sku-image.png",
            "content_type": "image/png",
            "folder": "sku-images",
        },
    )

    assert response.status_code == 201
    assert response.json()["upload_url"] == "http://minio/presigned-upload"
    assert response.json()["file_key"] == "sku-images/test-key.png"
    assert response.json()["file_url"] == "http://localhost:9000/erp-sku-images/sku-images/test-key.png"


@pytest.mark.asyncio
async def test_business_user_cannot_get_presigned_upload_url(
    client: AsyncClient,
    db_session: AsyncSession,
):
    await _login_as_role(client, db_session, UserRole.BUSINESS_DEPT)

    response = await client.post(
        "/api/v1/files/presigned-url",
        json={
            "filename": "sku-image.png",
            "content_type": "image/png",
            "folder": "sku-images",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "无权限执行此操作"


@pytest.mark.asyncio
async def test_product_user_can_delete_uploaded_object(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
):
    await _login_as_role(client, db_session, UserRole.PRODUCT_DEPT)
    deleted_keys: list[str] = []

    async def fake_delete_file(object_name: str):
        deleted_keys.append(object_name)

    monkeypatch.setattr(
        "app.services.files.delete_file",
        fake_delete_file,
    )

    response = await client.delete(
        "/api/v1/files/object",
        params={"object_key": "certificates/test-key.pdf"},
    )

    assert response.status_code == 204
    assert deleted_keys == ["certificates/test-key.pdf"]
