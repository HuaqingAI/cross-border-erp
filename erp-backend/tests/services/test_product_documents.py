from __future__ import annotations

import pytest

from app.core.exceptions import BusinessError
from app.schemas.product_document import (
    ProductDocumentAttachmentInput,
    ProductDocumentCreate,
    ProductDocumentUpdate,
)
from app.services.product_documents import ProductDocumentService


@pytest.mark.asyncio
async def test_blank_rich_text_is_treated_as_empty(db_session):
    service = ProductDocumentService(db_session)

    assert service._normalize_content_html("<p> &nbsp; </p>") is None
    assert service._normalize_content_html("<div>资料正文</div>") == "<div>资料正文</div>"


@pytest.mark.asyncio
async def test_validate_content_or_attachments_requires_at_least_one(db_session):
    service = ProductDocumentService(db_session)

    with pytest.raises(BusinessError, match="资料内容和资料文件至少填写一项"):
        service._validate_content_or_attachments(None, [])


@pytest.mark.asyncio
async def test_validate_attachment_rejects_mismatched_url(db_session):
    service = ProductDocumentService(db_session)

    with pytest.raises(BusinessError, match="资料附件URL与对象键不匹配"):
        service._validate_attachment(
            ProductDocumentAttachmentInput(
                object_key="product-documents/test.pdf",
                file_url="https://example.com/product-documents/test.pdf",
                file_name="test.pdf",
            )
        )


@pytest.mark.asyncio
async def test_normalize_countries_uppercases_and_deduplicates(db_session):
    service = ProductDocumentService(db_session)

    assert service._normalize_countries([" us ", "GLOBAL", "US"]) == ["US", "GLOBAL"]


@pytest.mark.asyncio
async def test_normalize_countries_rejects_non_standard_code(db_session):
    service = ProductDocumentService(db_session)

    with pytest.raises(BusinessError, match="适用国家/地区必须为标准编码"):
        service._normalize_countries(["China"])


def test_schema_normalizes_name_and_optional_text_fields():
    payload = ProductDocumentCreate(
        name="  资料名称  ",
        document_type="  产品手册  ",
        content_html="<p>资料</p>",
        ownership_type="通用",
        remarks="  备注  ",
    )

    assert payload.name == "资料名称"
    assert payload.document_type == "产品手册"
    assert payload.remarks == "备注"


def test_schema_rejects_blank_name_and_collapses_blank_optional_text():
    with pytest.raises(ValueError, match="资料名称不能为空"):
        ProductDocumentCreate(
            name="   ",
            document_type="产品手册",
            content_html="<p>资料</p>",
            ownership_type="通用",
        )

    payload = ProductDocumentUpdate(name=" 修订名 ", document_type="   ", remarks="   ")
    assert payload.name == "修订名"
    assert payload.document_type is None
    assert payload.remarks is None
