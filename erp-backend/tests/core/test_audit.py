import pytest
from sqlalchemy import select

from app.core.audit import audit_service
from app.models.audit_log import AuditLog
from app.models.user import User


@pytest.mark.asyncio
async def test_audit_service_log_uses_existing_session(db_session, test_user: User):
    record = await audit_service.log(
        user=test_user,
        action="update_certificate_status",
        entity_type="certificate",
        entity_id=12,
        before={"status": "valid"},
        after={"status": "expired"},
        db=db_session,
    )
    await db_session.commit()
    await db_session.refresh(record)

    result = await db_session.execute(select(AuditLog))
    stored = result.scalar_one()

    assert stored.user_id == test_user.id
    assert stored.action == "update_certificate_status"
    assert stored.entity_type == "certificate"
    assert stored.entity_id == 12
    assert stored.changes_before == {"status": "valid"}
    assert stored.changes_after == {"status": "expired"}
    assert stored.created_at is not None


@pytest.mark.asyncio
async def test_audit_service_log_stays_inside_current_transaction(
    db_session, test_user: User
):
    record = await audit_service.log(
        user=test_user,
        action="deactivate_user",
        entity_type="user",
        entity_id=test_user.id,
        before={"is_active": True},
        after={"is_active": False},
        db=db_session,
    )
    await db_session.rollback()

    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == "deactivate_user")
    )
    stored = result.scalar_one_or_none()

    assert stored is None


@pytest.mark.asyncio
async def test_audit_service_log_requires_explicit_session(test_user: User):
    with pytest.raises(TypeError):
        await audit_service.log(
            user=test_user,
            action="create_user",
            entity_type="user",
            entity_id=test_user.id,
            before=None,
            after={"username": "testuser"},
        )
