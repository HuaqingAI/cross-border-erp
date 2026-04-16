from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.user import User


class AuditService:
    """统一审计日志写入入口。"""

    async def log(
        self,
        user: User | int,
        action: str,
        entity_type: str,
        entity_id: int | None = None,
        before: dict[str, Any] | None = None,
        after: dict[str, Any] | None = None,
        *,
        db: AsyncSession,
    ) -> AuditLog:
        return await self._write_record(
            db=db,
            user=user,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before=before,
            after=after,
        )

    async def _write_record(
        self,
        db: AsyncSession,
        user: User | int,
        action: str,
        entity_type: str,
        entity_id: int | None,
        before: dict[str, Any] | None,
        after: dict[str, Any] | None,
    ) -> AuditLog:
        user_id = getattr(user, "id", user)
        if user_id is None:
            raise ValueError("审计日志需要有效的 user.id")

        record = AuditLog(
            user_id=int(user_id),
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            changes_before=jsonable_encoder(before),
            changes_after=jsonable_encoder(after),
        )
        db.add(record)
        await db.flush()
        return record


audit_service = AuditService()


async def log_action(
    user_id: int,
    action: str,
    resource: str,
    resource_id: int | None = None,
    details: dict[str, Any] | None = None,
    *,
    db: AsyncSession,
) -> AuditLog:
    """兼容旧占位接口，内部转发到统一 audit_service。"""
    return await audit_service.log(
        user=user_id,
        action=action,
        entity_type=resource,
        entity_id=resource_id,
        before=None,
        after=details,
        db=db,
    )


__all__ = ["AuditService", "audit_service", "log_action"]
