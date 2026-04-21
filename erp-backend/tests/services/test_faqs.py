from __future__ import annotations

import pytest

from app.core.exceptions import BusinessError
from app.schemas.faq import FAQCreate, FAQUpdate
from app.services.faqs import FAQService


def test_schema_normalizes_question_answer_and_optional_fields():
    payload = FAQCreate(
        question="  常见问题  ",
        answer="  常见答案  ",
        question_type="  售后  ",
        attachment_object_key="  faqs/demo.pdf  ",
        attachment_file_url="  http://localhost:9000/erp-files/faqs/demo.pdf  ",
        attachment_file_name="  demo.pdf  ",
    )

    assert payload.question == "常见问题"
    assert payload.answer == "常见答案"
    assert payload.question_type == "售后"
    assert payload.attachment_object_key == "faqs/demo.pdf"
    assert payload.attachment_file_url == "http://localhost:9000/erp-files/faqs/demo.pdf"
    assert payload.attachment_file_name == "demo.pdf"


def test_schema_rejects_long_question_and_collapses_blank_optional_fields():
    with pytest.raises(ValueError, match="问题最大 200 字"):
        FAQCreate(
            question="问" * 201,
            answer="答案",
        )

    payload = FAQUpdate(question_type="   ", attachment_file_name="   ")
    assert payload.question_type is None
    assert payload.attachment_file_name is None


@pytest.mark.asyncio
async def test_normalize_attachment_fields_requires_complete_group(db_session):
    service = FAQService(db_session)

    with pytest.raises(BusinessError, match="FAQ附件信息不完整"):
        service._normalize_attachment_fields("faqs/demo.pdf", None, "demo.pdf")


@pytest.mark.asyncio
async def test_normalize_attachment_fields_rejects_mismatched_url(db_session):
    service = FAQService(db_session)

    with pytest.raises(BusinessError, match="FAQ附件URL与对象键不匹配"):
        service._normalize_attachment_fields(
            "faqs/demo.pdf",
            "https://example.com/demo.pdf",
            "demo.pdf",
        )
