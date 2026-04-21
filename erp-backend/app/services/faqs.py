from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessError
from app.core.storage import get_file_url
from app.models.faq import FAQ
from app.models.user import User
from app.repositories.faqs import FAQRepository
from app.repositories.spus import SPURepository
from app.schemas.faq import FAQCreate, FAQDetail, FAQListItem, FAQListResponse, FAQUpdate


class FAQService:
    ATTACHMENT_FOLDER = "faqs/"

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = FAQRepository(db)
        self.spu_repo = SPURepository(db)

    async def create_faq(self, data: FAQCreate, current_user: User):
        spu = await self._get_spu_or_none(data.spu_id)
        attachment_object_key, attachment_file_url, attachment_file_name = (
            self._normalize_attachment_fields(
                data.attachment_object_key,
                data.attachment_file_url,
                data.attachment_file_name,
            )
        )

        faq = FAQ(
            spu_id=spu.id if spu is not None else None,
            question_type=data.question_type,
            question=data.question,
            answer=data.answer,
            attachment_object_key=attachment_object_key,
            attachment_file_url=attachment_file_url,
            attachment_file_name=attachment_file_name,
        )
        await self.repo.save(faq)
        return await self.get_faq(faq.id, current_user)

    async def get_faq(self, faq_id: int, current_user: User):
        del current_user
        faq = await self.repo.get_with_related(faq_id)
        if faq is None:
            raise BusinessError("FAQ不存在", code="NOT_FOUND", status_code=404)
        return self._serialize_detail(faq)

    async def list_faqs(
        self,
        current_user: User,
        *,
        page: int,
        page_size: int,
        spu_id: int | None = None,
        question_type: str | None = None,
        keyword: str | None = None,
    ):
        del current_user
        if spu_id is not None:
            await self._get_spu_or_none(spu_id)
        items, total = await self.repo.list_faqs(
            page=page,
            page_size=page_size,
            spu_id=spu_id,
            question_type=question_type,
            keyword=keyword,
        )
        return FAQListResponse.model_validate(
            {
                "items": [self._serialize_list_item(item) for item in items],
                "total": total,
                "page": page,
                "page_size": page_size,
            }
        )

    async def update_faq(self, faq_id: int, data: FAQUpdate, current_user: User):
        faq = await self.repo.get_with_related(faq_id)
        if faq is None:
            raise BusinessError("FAQ不存在", code="NOT_FOUND", status_code=404)

        target_spu_id = data.spu_id if "spu_id" in data.model_fields_set else faq.spu_id
        spu = await self._get_spu_or_none(target_spu_id)

        (
            attachment_object_key,
            attachment_file_url,
            attachment_file_name,
        ) = self._resolve_attachment_fields_for_update(
            faq,
            data,
        )

        if "spu_id" in data.model_fields_set:
            faq.spu_id = spu.id if spu is not None else None
        if "question_type" in data.model_fields_set:
            faq.question_type = data.question_type
        if data.question is not None:
            faq.question = data.question
        if data.answer is not None:
            faq.answer = data.answer
        if (
            "attachment_object_key" in data.model_fields_set
            or "attachment_file_url" in data.model_fields_set
            or "attachment_file_name" in data.model_fields_set
        ):
            faq.attachment_object_key = attachment_object_key
            faq.attachment_file_url = attachment_file_url
            faq.attachment_file_name = attachment_file_name

        await self.repo.save(faq)
        return await self.get_faq(faq.id, current_user)

    async def delete_faq(self, faq_id: int, current_user: User) -> None:
        del current_user
        faq = await self.repo.get_with_related(faq_id)
        if faq is None:
            raise BusinessError("FAQ不存在", code="NOT_FOUND", status_code=404)
        await self.repo.soft_delete(faq)

    async def _get_spu_or_none(self, spu_id: int | None):
        if spu_id is None:
            return None
        spu = await self.spu_repo.get_by_id(spu_id)
        if spu is None:
            raise BusinessError("SPU不存在", code="NOT_FOUND", status_code=404)
        return spu

    def _normalize_attachment_fields(
        self,
        object_key: str | None,
        file_url: str | None,
        file_name: str | None,
    ) -> tuple[str | None, str | None, str | None]:
        if object_key is None and file_url is None and file_name is None:
            return None, None, None

        if not object_key or not file_url or not file_name:
            raise BusinessError("FAQ附件信息不完整")
        if not object_key.startswith(self.ATTACHMENT_FOLDER):
            raise BusinessError("FAQ附件对象键非法")

        expected_file_url = get_file_url(object_key)
        if file_url != expected_file_url:
            raise BusinessError("FAQ附件URL与对象键不匹配")

        return object_key, file_url, file_name

    def _resolve_attachment_fields_for_update(
        self,
        faq: FAQ,
        data: FAQUpdate,
    ) -> tuple[str | None, str | None, str | None]:
        attachment_fields = (
            "attachment_object_key",
            "attachment_file_url",
            "attachment_file_name",
        )
        if not any(field in data.model_fields_set for field in attachment_fields):
            return (
                faq.attachment_object_key,
                faq.attachment_file_url,
                faq.attachment_file_name,
            )

        # FAQ 附件在更新时按一组字段处理，任一显式 null 都表示清空整组附件。
        if any(
            field in data.model_fields_set and getattr(data, field) is None
            for field in attachment_fields
        ):
            return None, None, None

        return self._normalize_attachment_fields(
            data.attachment_object_key
            if "attachment_object_key" in data.model_fields_set
            else faq.attachment_object_key,
            data.attachment_file_url
            if "attachment_file_url" in data.model_fields_set
            else faq.attachment_file_url,
            data.attachment_file_name
            if "attachment_file_name" in data.model_fields_set
            else faq.attachment_file_name,
        )

    def _build_scope_summary(self, faq: FAQ) -> str:
        if faq.spu is None:
            return "全局"
        return f"SPU：{faq.spu.code}/{faq.spu.name}"

    def _serialize_list_item(self, faq: FAQ) -> FAQListItem:
        return FAQListItem.model_validate(
            {
                "id": faq.id,
                "spu_id": faq.spu_id,
                "question_type": faq.question_type,
                "question": faq.question,
                "answer": faq.answer,
                "scope_summary": self._build_scope_summary(faq),
                "spu_code": faq.spu.code if faq.spu is not None else None,
                "spu_name": faq.spu.name if faq.spu is not None else None,
                "attachment_object_key": faq.attachment_object_key,
                "attachment_file_url": faq.attachment_file_url,
                "attachment_file_name": faq.attachment_file_name,
                "created_at": faq.created_at,
            }
        )

    def _serialize_detail(self, faq: FAQ) -> FAQDetail:
        return FAQDetail.model_validate(
            {
                "id": faq.id,
                "spu_id": faq.spu_id,
                "question_type": faq.question_type,
                "question": faq.question,
                "answer": faq.answer,
                "scope_summary": self._build_scope_summary(faq),
                "spu_code": faq.spu.code if faq.spu is not None else None,
                "spu_name": faq.spu.name if faq.spu is not None else None,
                "attachment_object_key": faq.attachment_object_key,
                "attachment_file_url": faq.attachment_file_url,
                "attachment_file_name": faq.attachment_file_name,
                "created_at": faq.created_at,
                "updated_at": faq.updated_at,
            }
        )
