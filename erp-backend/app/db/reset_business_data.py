"""
清空演示环境业务数据，保留用户账号与系统枚举。

用法：
  cd erp-backend && python -m app.db.reset_business_data --preview
  cd erp-backend && python -m app.db.reset_business_data --confirm clear-business-data
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal, engine
from app.models.audit_log import AuditLog
from app.models.certificate import (
    Certificate,
    CertificateCategoryAssignment,
    CertificateSPUAssignment,
)
from app.models.faq import FAQ
from app.models.import_task import ImportTask
from app.models.price import Price, PriceRegion
from app.models.product_category import ProductCategory
from app.models.product_document import (
    ProductDocument,
    ProductDocumentAttachment,
    ProductDocumentCategoryAssignment,
    ProductDocumentSKUAssignment,
)
from app.models.sku import SKU, SKUPackageDetail, SKUImage
from app.models.spu import SPU, SPUInvoiceInfo
from app.models.system_enum import SystemEnum
from app.models.user import User

CONFIRM_TOKEN = "clear-business-data"

CLEAR_ORDER = (
    ("audit_logs", AuditLog),
    ("import_tasks", ImportTask),
    ("price_regions", PriceRegion),
    ("prices", Price),
    ("product_document_attachments", ProductDocumentAttachment),
    ("product_document_sku_assignments", ProductDocumentSKUAssignment),
    ("product_document_category_assignments", ProductDocumentCategoryAssignment),
    ("product_documents", ProductDocument),
    ("certificate_spu_assignments", CertificateSPUAssignment),
    ("certificate_category_assignments", CertificateCategoryAssignment),
    ("certificates", Certificate),
    ("faqs", FAQ),
    ("sku_images", SKUImage),
    ("sku_package_details", SKUPackageDetail),
    ("skus", SKU),
    ("spu_invoice_infos", SPUInvoiceInfo),
    ("spus", SPU),
    ("product_categories", ProductCategory),
)

PRESERVED_TABLES = (
    ("users", User),
    ("enums", SystemEnum),
)


async def _count_rows(session: AsyncSession, model) -> int:
    return int((await session.execute(select(func.count()).select_from(model))).scalar_one())


async def _collect_counts(session: AsyncSession, entries) -> dict[str, int]:
    result: dict[str, int] = {}
    for label, model in entries:
        result[label] = await _count_rows(session, model)
    return result


async def reset_business_data(*, preview: bool, confirm: str | None) -> None:
    async with AsyncSessionLocal() as session:
        target_counts = await _collect_counts(session, CLEAR_ORDER)
        preserved_counts = await _collect_counts(session, PRESERVED_TABLES)

        print("将清理以下业务表：")
        for label, _ in CLEAR_ORDER:
            print(f"  {label}: {target_counts[label]}")

        print("\n将保留以下基础表：")
        for label, _ in PRESERVED_TABLES:
            print(f"  {label}: {preserved_counts[label]}")

        if preview:
            print("\n当前为预览模式，未执行任何删除。")
            print("注意：对象存储中的历史附件文件不会被清理。")
            return

        if confirm != CONFIRM_TOKEN:
            raise SystemExit(
                f"危险操作已中止。请显式传入 --confirm {CONFIRM_TOKEN}"
            )

        deleted_counts: dict[str, int] = {}
        try:
            for label, model in CLEAR_ORDER:
                result = await session.execute(delete(model))
                deleted_counts[label] = int(result.rowcount or 0)
            await session.commit()
        except Exception:
            await session.rollback()
            raise

    print("\n业务数据清理完成：")
    for label, _ in CLEAR_ORDER:
        print(f"  {label}: 删除 {deleted_counts.get(label, 0)}")
    print("\n已保留 users / enums。")
    print("注意：对象存储中的历史附件文件不会被清理。")


async def _run(preview: bool, confirm: str | None) -> None:
    try:
        await reset_business_data(preview=preview, confirm=confirm)
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="清空演示环境业务数据，保留用户和枚举")
    parser.add_argument(
        "--preview",
        action="store_true",
        help="仅预览将清理的数据量，不执行删除",
    )
    parser.add_argument(
        "--confirm",
        type=str,
        default=None,
        help=f"执行删除前需传入确认口令：{CONFIRM_TOKEN}",
    )
    args = parser.parse_args()

    asyncio.run(_run(preview=args.preview, confirm=args.confirm))


if __name__ == "__main__":
    main()
