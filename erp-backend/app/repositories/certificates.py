from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.certificate import (
    Certificate,
    CertificateCategoryAssignment,
    CertificateSPUAssignment,
)
from app.repositories.base_repository import BaseRepository


class CertificateRepository(BaseRepository[Certificate]):
    EXPIRING_DAYS = 30

    def __init__(self, db: AsyncSession):
        super().__init__(Certificate, db)

    async def get_by_certificate_no(
        self,
        certificate_no: str,
        *,
        include_deleted: bool = False,
    ) -> Certificate | None:
        stmt = select(self.model).where(self.model.certificate_no == certificate_no)
        if not include_deleted:
            stmt = stmt.where(self.model.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_with_related(self, certificate_id: int) -> Certificate | None:
        result = await self.db.execute(
            select(self.model)
            .execution_options(populate_existing=True)
            .options(
                selectinload(self.model.spu_assignments).selectinload(
                    CertificateSPUAssignment.spu
                ),
                selectinload(self.model.category_assignments).selectinload(
                    CertificateCategoryAssignment.category
                ),
            )
            .where(
                self.model.id == certificate_id,
                self.model.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_certificates(
        self,
        *,
        page: int,
        page_size: int,
        certificate_type: str | None = None,
        ownership_type: str | None = None,
        validity_status: str | None = None,
        keyword: str | None = None,
    ) -> tuple[list[Certificate], int]:
        filters = [self.model.deleted_at.is_(None)]
        if certificate_type:
            filters.append(self.model.certificate_type == certificate_type)
        if ownership_type:
            filters.append(self.model.ownership_type == ownership_type)
        if keyword:
            like_value = f"%{keyword}%"
            filters.append(
                or_(
                    self.model.name.like(like_value),
                    self.model.certificate_no.like(like_value),
                )
            )
        if validity_status:
            today = date.today()
            expiring_upper = today + timedelta(days=self.EXPIRING_DAYS)
            if validity_status == "有效":
                filters.append(self.model.valid_to > expiring_upper)
            elif validity_status == "即将过期":
                filters.extend(
                    [
                        self.model.valid_to >= today,
                        self.model.valid_to <= expiring_upper,
                    ]
                )
            elif validity_status == "已过期":
                filters.append(self.model.valid_to < today)

        total_stmt = select(func.count()).select_from(self.model).where(*filters)
        total = (await self.db.execute(total_stmt)).scalar_one()

        stmt = (
            select(self.model)
            .options(
                selectinload(self.model.spu_assignments).selectinload(
                    CertificateSPUAssignment.spu
                ),
                selectinload(self.model.category_assignments).selectinload(
                    CertificateCategoryAssignment.category
                ),
            )
            .where(*filters)
            .order_by(self.model.created_at.desc(), self.model.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list((await self.db.execute(stmt)).scalars().all())
        return items, total

    async def list_active_spu_assignments(
        self,
        certificate_id: int,
    ) -> list[CertificateSPUAssignment]:
        result = await self.db.execute(
            select(CertificateSPUAssignment)
            .options(selectinload(CertificateSPUAssignment.spu))
            .where(
                CertificateSPUAssignment.certificate_id == certificate_id,
                CertificateSPUAssignment.deleted_at.is_(None),
            )
            .order_by(CertificateSPUAssignment.id)
        )
        return list(result.scalars().all())

    async def list_active_category_assignments(
        self,
        certificate_id: int,
    ) -> list[CertificateCategoryAssignment]:
        result = await self.db.execute(
            select(CertificateCategoryAssignment)
            .options(selectinload(CertificateCategoryAssignment.category))
            .where(
                CertificateCategoryAssignment.certificate_id == certificate_id,
                CertificateCategoryAssignment.deleted_at.is_(None),
            )
            .order_by(CertificateCategoryAssignment.id)
        )
        return list(result.scalars().all())

    async def save_spu_assignment(
        self,
        assignment: CertificateSPUAssignment,
    ) -> CertificateSPUAssignment:
        self.db.add(assignment)
        await self.db.flush()
        await self.db.refresh(assignment)
        return assignment

    async def save_category_assignment(
        self,
        assignment: CertificateCategoryAssignment,
    ) -> CertificateCategoryAssignment:
        self.db.add(assignment)
        await self.db.flush()
        await self.db.refresh(assignment)
        return assignment

    async def soft_delete_spu_assignments(
        self,
        assignments: list[CertificateSPUAssignment],
    ) -> None:
        now = datetime.now(timezone.utc)
        for assignment in assignments:
            assignment.deleted_at = now
            self.db.add(assignment)
        await self.db.flush()

    async def soft_delete_category_assignments(
        self,
        assignments: list[CertificateCategoryAssignment],
    ) -> None:
        now = datetime.now(timezone.utc)
        for assignment in assignments:
            assignment.deleted_at = now
            self.db.add(assignment)
        await self.db.flush()
