"""
基于现有分类 / SPU / SKU 导入演示内容。

默认仅补充：
- 证书
- 产品资料
- FAQ
- 价格

用法：
  cd erp-backend && python -m app.db.seed_demo_content --preview
  cd erp-backend && python -m app.db.seed_demo_content
"""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal, engine
from app.models.certificate import Certificate
from app.models.faq import FAQ
from app.models.price import Price
from app.models.product_category import ProductCategory
from app.models.product_document import ProductDocument
from app.models.sku import SKU
from app.models.spu import SPU
from app.models.user import User, UserRole
from app.schemas.certificate import CertificateCreate, CertificateOwnershipType
from app.schemas.faq import FAQCreate
from app.schemas.price import PriceApprovalStatus, PriceCreate, PriceRegionPayload, PriceRejectRequest
from app.schemas.product_document import (
    ProductDocumentCreate,
    ProductDocumentOwnershipType,
)
from app.services.certificates import CertificateService
from app.services.faqs import FAQService
from app.services.prices import PriceService
from app.services.product_documents import ProductDocumentService

DEMO_MARKER = "[DEMO-CONTENT]"


@dataclass
class DemoContext:
    product_actor: User
    finance_actor: User
    admin_actor: User
    categories: list[ProductCategory]
    spus: list[SPU]
    skus: list[SKU]


async def _get_user_by_role(session: AsyncSession, role: UserRole) -> User | None:
    return await session.scalar(
        select(User)
        .where(
            User.role == role,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
        .order_by(User.id.asc())
        .limit(1)
    )


async def _get_required_actor(
    session: AsyncSession,
    *,
    preferred_role: UserRole,
    fallback_role: UserRole | None = None,
    purpose: str,
) -> User:
    actor = await _get_user_by_role(session, preferred_role)
    if actor is not None:
        return actor

    if fallback_role is not None:
        actor = await _get_user_by_role(session, fallback_role)
        if actor is not None:
            return actor

    raise RuntimeError(f"缺少可用于{purpose}的账号，请至少保留 {preferred_role.value}")


async def _load_leaf_categories(session: AsyncSession) -> list[ProductCategory]:
    categories = list(
        (
            await session.execute(
                select(ProductCategory)
                .where(ProductCategory.deleted_at.is_(None))
                .order_by(
                    ProductCategory.level.desc(),
                    ProductCategory.created_at.desc(),
                    ProductCategory.id.desc(),
                )
            )
        ).scalars()
    )
    if not categories:
        return []

    parent_ids = {category.parent_id for category in categories if category.parent_id is not None}
    leaf_categories = [category for category in categories if category.id not in parent_ids]
    return leaf_categories or categories


async def _load_spus(session: AsyncSession) -> list[SPU]:
    return list(
        (
            await session.execute(
                select(SPU)
                .where(SPU.deleted_at.is_(None))
                .order_by(SPU.created_at.desc(), SPU.id.desc())
            )
        ).scalars()
    )


async def _load_skus(session: AsyncSession) -> list[SKU]:
    return list(
        (
            await session.execute(
                select(SKU)
                .where(SKU.deleted_at.is_(None))
                .order_by(SKU.created_at.desc(), SKU.id.desc())
            )
        ).scalars()
    )


async def _build_context(session: AsyncSession) -> DemoContext:
    product_actor = await _get_required_actor(
        session,
        preferred_role=UserRole.PRODUCT_DEPT,
        fallback_role=UserRole.ADMIN,
        purpose="导入产品演示内容",
    )
    finance_actor = await _get_required_actor(
        session,
        preferred_role=UserRole.FINANCE_DEPT,
        fallback_role=UserRole.ADMIN,
        purpose="导入价格演示内容",
    )
    admin_actor = await _get_required_actor(
        session,
        preferred_role=UserRole.ADMIN,
        purpose="审批价格演示数据",
    )

    categories = await _load_leaf_categories(session)
    spus = await _load_spus(session)
    skus = await _load_skus(session)

    if not categories:
        raise RuntimeError("未找到可用分类，请先导入分类数据")
    if not spus:
        raise RuntimeError("未找到可用 SPU，请先导入 SPU 数据")
    if not skus:
        raise RuntimeError("未找到可用 SKU，请先导入 SKU 数据")

    return DemoContext(
        product_actor=product_actor,
        finance_actor=finance_actor,
        admin_actor=admin_actor,
        categories=categories,
        spus=spus,
        skus=skus,
    )


async def _find_certificate(session: AsyncSession, certificate_no: str) -> Certificate | None:
    return await session.scalar(
        select(Certificate).where(Certificate.certificate_no == certificate_no)
    )


async def _find_document(session: AsyncSession, name: str) -> ProductDocument | None:
    return await session.scalar(select(ProductDocument).where(ProductDocument.name == name))


async def _find_faq(session: AsyncSession, question: str) -> FAQ | None:
    return await session.scalar(select(FAQ).where(FAQ.question == question))


async def _find_price(session: AsyncSession, sku_id: int) -> Price | None:
    return await session.scalar(select(Price).where(Price.sku_id == sku_id))


def _certificate_payloads(ctx: DemoContext) -> list[CertificateCreate]:
    first_spu = ctx.spus[0]
    first_category = ctx.categories[0]
    today = date.today()

    return [
        CertificateCreate(
            name="演示 CE 证书（通用）",
            certificate_no="DEMO-CERT-GENERAL",
            certificate_type="CE",
            issuing_authority="TUV Rheinland",
            valid_from=today - timedelta(days=45),
            valid_to=today + timedelta(days=365),
            ownership_type=CertificateOwnershipType.GENERAL,
            remarks=f"{DEMO_MARKER} 全局演示证书",
        ),
        CertificateCreate(
            name=f"演示 FDA 证书（{first_spu.name}）",
            certificate_no=f"DEMO-CERT-SPU-{first_spu.code}",
            certificate_type="FDA",
            issuing_authority="FDA",
            valid_from=today - timedelta(days=20),
            valid_to=today + timedelta(days=180),
            ownership_type=CertificateOwnershipType.SPU,
            spu_ids=[first_spu.id],
            remarks=f"{DEMO_MARKER} SPU归属演示证书",
        ),
        CertificateCreate(
            name=f"演示 ISO13485 证书（{first_category.name}）",
            certificate_no=f"DEMO-CERT-CATEGORY-{first_category.code}",
            certificate_type="ISO13485",
            issuing_authority="SGS",
            valid_from=today - timedelta(days=120),
            valid_to=today + timedelta(days=25),
            ownership_type=CertificateOwnershipType.CATEGORY,
            category_ids=[first_category.id],
            remarks=f"{DEMO_MARKER} 分类归属演示证书",
        ),
    ]


def _document_payloads(ctx: DemoContext) -> list[ProductDocumentCreate]:
    first_sku = ctx.skus[0]
    first_category = ctx.categories[0]

    return [
        ProductDocumentCreate(
            name="演示版产品手册-通用",
            document_type="产品手册",
            content_html=(
                f"<h3>{DEMO_MARKER} 通用产品手册</h3>"
                "<p>用于演示列表页、详情页、富文本预览和附件区域。</p>"
            ),
            ownership_type=ProductDocumentOwnershipType.GENERAL,
            applicable_countries=["GLOBAL", "US", "DE"],
            attachments=[],
            remarks=f"{DEMO_MARKER} 通用资料",
        ),
        ProductDocumentCreate(
            name=f"演示版安装说明-{first_sku.code}",
            document_type="安装说明",
            content_html=(
                f"<p>{first_sku.name_zh} 的安装步骤、摆放要求和通电检查清单。</p>"
            ),
            ownership_type=ProductDocumentOwnershipType.SKU,
            sku_ids=[first_sku.id],
            applicable_countries=["CN", "US"],
            attachments=[],
            remarks=f"{DEMO_MARKER} SKU归属资料",
        ),
        ProductDocumentCreate(
            name=f"演示版培训资料-{first_category.code}",
            document_type="培训资料",
            content_html=(
                f"<p>面向分类 {first_category.name} 的培训卖点、常见问题和演示话术。</p>"
            ),
            ownership_type=ProductDocumentOwnershipType.CATEGORY,
            category_ids=[first_category.id],
            applicable_countries=["DE", "US"],
            attachments=[],
            remarks=f"{DEMO_MARKER} 分类归属资料",
        ),
    ]


def _faq_payloads(ctx: DemoContext) -> list[FAQCreate]:
    payloads = [
        FAQCreate(
            question_type="使用",
            question=f"{DEMO_MARKER} 这套产品支持哪些电压规格？",
            answer="默认支持 220V/50Hz，海外版本可根据目标国家配置不同电压。",
        )
    ]

    if ctx.spus:
        first_spu = ctx.spus[0]
        payloads.append(
            FAQCreate(
                spu_id=first_spu.id,
                question_type="售后",
                question=f"{DEMO_MARKER} {first_spu.code} 如何校准报警阈值？",
                answer="进入设备设置页后选择报警管理，按临床场景保存阈值模板即可。",
            )
        )

    if len(ctx.spus) > 1:
        second_spu = ctx.spus[1]
        payloads.append(
            FAQCreate(
                spu_id=second_spu.id,
                question_type="安装",
                question=f"{DEMO_MARKER} {second_spu.code} 首次开机前需要检查什么？",
                answer="确认电源、附件连接和系统时间后，再执行首次自检流程。",
            )
        )

    return payloads


def _price_targets(ctx: DemoContext) -> list[tuple[int, list[PriceRegionPayload], PriceApprovalStatus, str | None]]:
    sku_targets = ctx.skus[:3]
    scenarios: list[tuple[int, list[PriceRegionPayload], PriceApprovalStatus, str | None]] = []

    if sku_targets:
        scenarios.append(
            (
                sku_targets[0].id,
                [
                    PriceRegionPayload(currency="USD", sale_price="259.00", list_price="329.00"),
                    PriceRegionPayload(
                        country_code="CN",
                        country_name="中国",
                        currency="CNY",
                        sale_price="1880.00",
                        list_price="2080.00",
                        remarks=f"{DEMO_MARKER} 已生效演示价格",
                        sort_order=1,
                    ),
                ],
                PriceApprovalStatus.ACTIVE,
                None,
            )
        )

    if len(sku_targets) > 1:
        scenarios.append(
            (
                sku_targets[1].id,
                [
                    PriceRegionPayload(currency="USD", sale_price="319.00", list_price="399.00"),
                    PriceRegionPayload(
                        country_code="US",
                        country_name="美国",
                        currency="USD",
                        sale_price="329.00",
                        list_price="419.00",
                        remarks=f"{DEMO_MARKER} 待审批演示价格",
                        sort_order=1,
                    ),
                ],
                PriceApprovalStatus.PENDING,
                None,
            )
        )

    if len(sku_targets) > 2:
        scenarios.append(
            (
                sku_targets[2].id,
                [
                    PriceRegionPayload(currency="EUR", sale_price="499.00", list_price="579.00"),
                    PriceRegionPayload(
                        country_code="DE",
                        country_name="德国",
                        currency="EUR",
                        sale_price="519.00",
                        list_price="599.00",
                        remarks=f"{DEMO_MARKER} 已驳回演示价格",
                        sort_order=1,
                    ),
                ],
                PriceApprovalStatus.REJECTED,
                "演示驳回：请补充德国市场税费说明后重新提交。",
            )
        )

    return scenarios


async def seed_demo_content(*, preview: bool) -> None:
    async with AsyncSessionLocal() as session:
        context = await _build_context(session)

        print("检测到可用基础数据：")
        print(f"  分类: {len(context.categories)}")
        print(f"  SPU: {len(context.spus)}")
        print(f"  SKU: {len(context.skus)}")
        print(f"  产品内容账号: {context.product_actor.username} ({context.product_actor.role.value})")
        print(f"  价格内容账号: {context.finance_actor.username} ({context.finance_actor.role.value})")
        print(f"  审批账号: {context.admin_actor.username} ({context.admin_actor.role.value})")

        certificate_payloads = _certificate_payloads(context)
        document_payloads = _document_payloads(context)
        faq_payloads = _faq_payloads(context)
        price_targets = _price_targets(context)

        print("\n计划导入：")
        for payload in certificate_payloads:
            print(f"  证书: {payload.certificate_no}")
        for payload in document_payloads:
            print(f"  资料: {payload.name}")
        for payload in faq_payloads:
            print(f"  FAQ: {payload.question}")
        for sku_id, _, status, _ in price_targets:
            print(f"  价格: sku_id={sku_id} -> {status.value}")

        if preview:
            print("\n当前为预览模式，未写入任何数据。")
            return

        certificate_service = CertificateService(session)
        document_service = ProductDocumentService(session)
        faq_service = FAQService(session)
        price_service = PriceService(session)

        created_counts = {
            "certificates": 0,
            "documents": 0,
            "faqs": 0,
            "prices": 0,
        }
        skipped_counts = {
            "certificates": 0,
            "documents": 0,
            "faqs": 0,
            "prices": 0,
        }

        try:
            for payload in certificate_payloads:
                if await _find_certificate(session, payload.certificate_no):
                    skipped_counts["certificates"] += 1
                    continue
                await certificate_service.create_certificate(payload, context.product_actor)
                created_counts["certificates"] += 1

            for payload in document_payloads:
                if await _find_document(session, payload.name):
                    skipped_counts["documents"] += 1
                    continue
                await document_service.create_product_document(payload, context.product_actor)
                created_counts["documents"] += 1

            for payload in faq_payloads:
                if await _find_faq(session, payload.question):
                    skipped_counts["faqs"] += 1
                    continue
                await faq_service.create_faq(payload, context.product_actor)
                created_counts["faqs"] += 1

            for sku_id, regions, target_status, reject_reason in price_targets:
                if await _find_price(session, sku_id):
                    skipped_counts["prices"] += 1
                    continue

                detail = await price_service.create_price(
                    PriceCreate(sku_id=sku_id, regions=regions),
                    context.finance_actor,
                )
                if target_status == PriceApprovalStatus.PENDING:
                    await price_service.submit_price(detail.id, context.finance_actor)
                elif target_status == PriceApprovalStatus.ACTIVE:
                    await price_service.submit_price(detail.id, context.finance_actor)
                    await price_service.approve_price(detail.id, context.admin_actor)
                elif target_status == PriceApprovalStatus.REJECTED:
                    await price_service.submit_price(detail.id, context.finance_actor)
                    await price_service.reject_price(
                        detail.id,
                        PriceRejectRequest(reason=reject_reason or "演示驳回"),
                        context.admin_actor,
                    )

                created_counts["prices"] += 1

            await session.commit()
        except Exception:
            await session.rollback()
            raise

    print("\n演示内容导入完成：")
    for key in ("certificates", "documents", "faqs", "prices"):
        print(f"  {key}: 新增 {created_counts[key]}，跳过 {skipped_counts[key]}")


async def _run(preview: bool) -> None:
    try:
        await seed_demo_content(preview=preview)
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="基于现有分类 / SPU / SKU 导入演示内容")
    parser.add_argument(
        "--preview",
        action="store_true",
        help="仅预览将导入的内容，不实际写入",
    )
    args = parser.parse_args()

    asyncio.run(_run(preview=args.preview))


if __name__ == "__main__":
    main()
