"""
开发/测试种子数据。

默认写入：
- 4 个测试用户
- 演示分类 / SPU / SKU
- 证书、产品资料、FAQ、价格演示数据

用法：cd erp-backend && python -m app.db.seed
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import hash_password
from app.core.storage import get_file_url
from app.models.certificate import Certificate
from app.models.faq import FAQ
from app.models.price import Price
from app.models.product_category import ProductCategory
from app.models.product_document import ProductDocument
from app.models.sku import SKU
from app.models.spu import SPU
from app.models.system_enum import SystemEnum
from app.models.user import User, UserRole
from app.schemas.certificate import CertificateCreate, CertificateOwnershipType
from app.schemas.faq import FAQCreate
from app.schemas.price import PriceApprovalStatus, PriceCreate, PriceRegionPayload, PriceRejectRequest
from app.schemas.product_category import ProductCategoryCreate
from app.schemas.product_document import (
    ProductDocumentAttachmentInput,
    ProductDocumentCreate,
    ProductDocumentOwnershipType,
)
from app.schemas.sku import SKUCreate, SKUPackageDetailPayload
from app.schemas.spu import SPUCreate, SPUInvoiceInfoPayload
from app.services.certificates import CertificateService
from app.services.faqs import FAQService
from app.services.prices import PriceService
from app.services.product_categories import ProductCategoryService
from app.services.product_documents import ProductDocumentService
from app.services.skus import SKUService
from app.services.spus import SPUService

SEED_USERS = [
    {"username": "admin", "password": "Admin123!", "role": UserRole.ADMIN},
    {"username": "product_user", "password": "Test123!", "role": UserRole.PRODUCT_DEPT},
    {"username": "business_user", "password": "Test123!", "role": UserRole.BUSINESS_DEPT},
    {"username": "finance_user", "password": "Test123!", "role": UserRole.FINANCE_DEPT},
]

DEMO_ENUMS = [
    ("certificate_type", "CE", "CE", "系统默认认证类型", 10),
    ("certificate_type", "FDA", "FDA", "系统默认认证类型", 20),
    ("certificate_type", "ISO13485", "ISO13485", "系统默认认证类型", 30),
    ("faq_question_type", "售后", "售后", "系统默认 FAQ 类型", 10),
    ("faq_question_type", "安装", "安装", "系统默认 FAQ 类型", 20),
    ("faq_question_type", "使用", "使用", "系统默认 FAQ 类型", 30),
    ("document_type", "产品手册", "产品手册", "系统默认资料类型", 10),
    ("document_type", "安装说明", "安装说明", "系统默认资料类型", 20),
    ("document_type", "培训资料", "培训资料", "系统默认资料类型", 30),
    ("product_type", "主品", "主品", "系统默认产品类型", 10),
    ("product_status", "上架", "上架", "系统默认产品状态", 10),
    ("currency", "CNY", "CNY", "系统默认币种", 10),
    ("currency", "USD", "USD", "系统默认币种", 20),
    ("currency", "EUR", "EUR", "系统默认币种", 30),
    ("country_region", "GLOBAL", "全球", "系统保留默认区域", 0),
    ("country_region", "CN", "中国", "系统默认国家/地区", 10),
    ("country_region", "US", "美国", "系统默认国家/地区", 20),
    ("country_region", "DE", "德国", "系统默认国家/地区", 30),
]


def _invoice_infos(name: str) -> list[SPUInvoiceInfoPayload]:
    return [
        SPUInvoiceInfoPayload(
            invoice_name=f"{name}标准开票名",
            invoice_unit="台",
            invoice_model="INV-STD",
            company_subject="华青医疗",
            sort_order=0,
        )
    ]


def _package_details() -> list[SKUPackageDetailPayload]:
    return [
        SKUPackageDetailPayload(
            net_weight_kg="3.800",
            gross_weight_kg="4.300",
            length_cm="52.000",
            width_cm="36.000",
            height_cm="28.000",
            volume_cbm="0.052",
            sort_order=0,
        )
    ]


async def _get_user_by_username(session: AsyncSession, username: str) -> User | None:
    return await session.scalar(select(User).where(User.username == username))


async def _get_category_by_code(session: AsyncSession, code: str) -> ProductCategory | None:
    return await session.scalar(select(ProductCategory).where(ProductCategory.code == code))


async def _get_spu_by_code(session: AsyncSession, code: str) -> SPU | None:
    return await session.scalar(select(SPU).where(SPU.code == code))


async def _get_sku_by_code(session: AsyncSession, code: str) -> SKU | None:
    return await session.scalar(select(SKU).where(SKU.code == code))


async def _get_certificate_by_no(
    session: AsyncSession,
    certificate_no: str,
) -> Certificate | None:
    return await session.scalar(
        select(Certificate).where(Certificate.certificate_no == certificate_no)
    )


async def _get_document_by_name(session: AsyncSession, name: str) -> ProductDocument | None:
    return await session.scalar(
        select(ProductDocument).where(ProductDocument.name == name)
    )


async def _get_faq_by_question(session: AsyncSession, question: str) -> FAQ | None:
    return await session.scalar(select(FAQ).where(FAQ.question == question))


async def _get_price_by_sku_id(session: AsyncSession, sku_id: int) -> Price | None:
    return await session.scalar(select(Price).where(Price.sku_id == sku_id))


async def _ensure_user(
    session: AsyncSession,
    *,
    username: str,
    password: str,
    role: UserRole,
) -> tuple[User, bool]:
    user = await _get_user_by_username(session, username)
    created = user is None

    if user is None:
        user = User(
            username=username,
            password_hash=hash_password(password),
            role=role,
            is_active=True,
        )
    else:
        user.password_hash = hash_password(password)
        user.role = role
        user.is_active = True
        user.deleted_at = None

    session.add(user)
    await session.flush()
    return user, created


async def _ensure_enum(
    session: AsyncSession,
    *,
    enum_group: str,
    enum_key: str,
    enum_value: str,
    description: str,
    sort_order: int,
) -> bool:
    entity = await session.scalar(
        select(SystemEnum).where(
            SystemEnum.enum_group == enum_group,
            SystemEnum.enum_key == enum_key,
        )
    )
    created = entity is None

    if entity is None:
        entity = SystemEnum(
            enum_group=enum_group,
            enum_key=enum_key,
            enum_value=enum_value,
            description=description,
            sort_order=sort_order,
            is_enabled=True,
        )
    else:
        entity.enum_value = enum_value
        entity.description = description
        entity.sort_order = sort_order
        entity.is_enabled = True
        entity.deleted_at = None

    session.add(entity)
    await session.flush()
    return created


async def _ensure_category(
    session: AsyncSession,
    service: ProductCategoryService,
    *,
    code: str,
    name: str,
    parent_id: int | None = None,
) -> tuple[ProductCategory, bool]:
    category = await _get_category_by_code(session, code)
    if category is not None:
        parent = (
            None
            if parent_id is None
            else await session.get(ProductCategory, parent_id)
        )
        category.name = name
        category.parent_id = parent_id
        category.level = 1 if parent is None else parent.level + 1
        category.deleted_at = None
        session.add(category)
        await session.flush()
        await session.refresh(category)
        return category, False

    created = await service.create_category(
        ProductCategoryCreate(code=code, name=name, parent_id=parent_id)
    )
    return created, True


async def _ensure_spu(
    session: AsyncSession,
    service: SPUService,
    current_user: User,
    *,
    code: str,
    name: str,
    categories: tuple[ProductCategory, ProductCategory, ProductCategory],
    supplier_name: str,
    manufacturer_model: str,
    purchase_price: str,
) -> tuple[SPU, bool]:
    existing = await _get_spu_by_code(session, code)
    if existing is not None:
        existing.deleted_at = None
        session.add(existing)
        await session.flush()
        await session.refresh(existing)
        return existing, False

    level1, level2, level3 = categories
    await service.create_spu(
        SPUCreate(
            code=code,
            name=name,
            level1_category_id=level1.id,
            level2_category_id=level2.id,
            level3_category_id=level3.id,
            customer_warranty_months=24,
            unit="台",
            restricted_countries=["US", "DE"],
            supplier_name=supplier_name,
            manufacturer_model=manufacturer_model,
            purchase_price=purchase_price,
            purchase_warranty_months=12,
            supplier_warranty_notes="演示环境标准质保说明",
            invoice_infos=_invoice_infos(name),
        ),
        current_user,
    )
    spu = await _get_spu_by_code(session, code)
    assert spu is not None
    return spu, True


async def _ensure_sku(
    session: AsyncSession,
    service: SKUService,
    current_user: User,
    *,
    spu_id: int,
    code: str,
    name_zh: str,
    name_en: str,
    product_model: str,
    has_plug: bool,
    material: str,
) -> tuple[SKU, bool]:
    existing = await _get_sku_by_code(session, code)
    if existing is not None:
        existing.deleted_at = None
        session.add(existing)
        await session.flush()
        await session.refresh(existing)
        return existing, False

    await service.create_sku(
        SKUCreate(
            spu_id=spu_id,
            code=code,
            name_zh=name_zh,
            name_en=name_en,
            product_model=product_model,
            product_type="主品",
            core_params="演示版核心参数，适合列表和详情页展示",
            product_status="上架",
            electrical_params="220V/50Hz",
            principle="演示环境下的工作原理说明",
            usage="用于系统演示、培训与交互验证",
            material=material,
            unit="台",
            has_plug=has_plug,
            is_special=False,
            special_notes=None,
            package_type="纸箱",
            package_quantity=1,
            package_details=_package_details(),
        ),
        current_user,
    )
    sku = await _get_sku_by_code(session, code)
    assert sku is not None
    return sku, True


async def _ensure_certificate(
    session: AsyncSession,
    service: CertificateService,
    current_user: User,
    payload: CertificateCreate,
) -> bool:
    existing = await _get_certificate_by_no(session, payload.certificate_no)
    if existing is not None:
        existing.deleted_at = None
        session.add(existing)
        await session.flush()
        return False

    await service.create_certificate(payload, current_user)
    return True


async def _ensure_document(
    session: AsyncSession,
    service: ProductDocumentService,
    current_user: User,
    payload: ProductDocumentCreate,
) -> bool:
    existing = await _get_document_by_name(session, payload.name)
    if existing is not None:
        existing.deleted_at = None
        session.add(existing)
        await session.flush()
        return False

    await service.create_product_document(payload, current_user)
    return True


async def _ensure_faq(
    session: AsyncSession,
    service: FAQService,
    current_user: User,
    payload: FAQCreate,
) -> bool:
    existing = await _get_faq_by_question(session, payload.question)
    if existing is not None:
        existing.deleted_at = None
        session.add(existing)
        await session.flush()
        return False

    await service.create_faq(payload, current_user)
    return True


async def _ensure_price(
    session: AsyncSession,
    service: PriceService,
    finance_user: User,
    admin_user: User,
    *,
    sku_id: int,
    regions: list[PriceRegionPayload],
    target_status: PriceApprovalStatus,
    reject_reason: str | None = None,
) -> bool:
    existing = await _get_price_by_sku_id(session, sku_id)
    if existing is not None:
        existing.deleted_at = None
        session.add(existing)
        await session.flush()
        return False

    detail = await service.create_price(
        PriceCreate(sku_id=sku_id, regions=regions),
        finance_user,
    )
    price_id = detail.id

    if target_status == PriceApprovalStatus.PENDING:
        await service.submit_price(price_id, finance_user)
    elif target_status == PriceApprovalStatus.ACTIVE:
        await service.submit_price(price_id, finance_user)
        await service.approve_price(price_id, admin_user)
    elif target_status == PriceApprovalStatus.REJECTED:
        await service.submit_price(price_id, finance_user)
        await service.reject_price(
            price_id,
            PriceRejectRequest(reason=reject_reason or "演示环境驳回"),
            admin_user,
        )

    return True


async def seed() -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    summary: dict[str, dict[str, int]] = defaultdict(lambda: {"created": 0, "reused": 0})

    async with async_session() as session:
        product_category_service = ProductCategoryService(session)
        spu_service = SPUService(session)
        sku_service = SKUService(session)
        certificate_service = CertificateService(session)
        document_service = ProductDocumentService(session)
        faq_service = FAQService(session)
        price_service = PriceService(session)

        users: dict[str, User] = {}
        for item in SEED_USERS:
            user, created = await _ensure_user(
                session,
                username=item["username"],
                password=item["password"],
                role=item["role"],
            )
            users[item["username"]] = user
            summary["users"]["created" if created else "reused"] += 1

        for enum_group, enum_key, enum_value, description, sort_order in DEMO_ENUMS:
            created = await _ensure_enum(
                session,
                enum_group=enum_group,
                enum_key=enum_key,
                enum_value=enum_value,
                description=description,
                sort_order=sort_order,
            )
            summary["enums"]["created" if created else "reused"] += 1

        monitor_tree = []
        for code, name, parent_id in [
            ("DEMO-CAT-MONITOR-L1", "监护设备", None),
            ("DEMO-CAT-MONITOR-L2", "床旁监护", "DEMO-CAT-MONITOR-L1"),
            ("DEMO-CAT-MONITOR-L3", "多参数监护仪", "DEMO-CAT-MONITOR-L2"),
        ]:
            parent = None if parent_id is None else await _get_category_by_code(session, parent_id)
            category, created = await _ensure_category(
                session,
                product_category_service,
                code=code,
                name=name,
                parent_id=parent.id if parent is not None else None,
            )
            monitor_tree.append(category)
            summary["categories"]["created" if created else "reused"] += 1

        ultrasound_tree = []
        for code, name, parent_id in [
            ("DEMO-CAT-ULTRASOUND-L1", "超声设备", None),
            ("DEMO-CAT-ULTRASOUND-L2", "便携超声", "DEMO-CAT-ULTRASOUND-L1"),
            ("DEMO-CAT-ULTRASOUND-L3", "便携彩超", "DEMO-CAT-ULTRASOUND-L2"),
        ]:
            parent = None if parent_id is None else await _get_category_by_code(session, parent_id)
            category, created = await _ensure_category(
                session,
                product_category_service,
                code=code,
                name=name,
                parent_id=parent.id if parent is not None else None,
            )
            ultrasound_tree.append(category)
            summary["categories"]["created" if created else "reused"] += 1

        monitor_spu, created = await _ensure_spu(
            session,
            spu_service,
            users["product_user"],
            code="DEMO-SPU-MONITOR-001",
            name="演示多参数监护仪",
            categories=tuple(monitor_tree),
            supplier_name="深圳演示医疗科技",
            manufacturer_model="DM-MONITOR-X1",
            purchase_price="1680.00",
        )
        summary["spus"]["created" if created else "reused"] += 1

        ultrasound_spu, created = await _ensure_spu(
            session,
            spu_service,
            users["product_user"],
            code="DEMO-SPU-ULTRASOUND-001",
            name="演示便携彩超",
            categories=tuple(ultrasound_tree),
            supplier_name="上海演示影像设备",
            manufacturer_model="DM-ULTRA-P8",
            purchase_price="3280.00",
        )
        summary["spus"]["created" if created else "reused"] += 1

        sku_monitor_basic, created = await _ensure_sku(
            session,
            sku_service,
            users["product_user"],
            spu_id=monitor_spu.id,
            code="DEMO-SKU-MONITOR-001",
            name_zh="演示监护仪标准版",
            name_en="Demo Monitor Standard",
            product_model="DM-MONITOR-X1-STD",
            has_plug=True,
            material="ABS+铝合金",
        )
        summary["skus"]["created" if created else "reused"] += 1

        sku_monitor_pro, created = await _ensure_sku(
            session,
            sku_service,
            users["product_user"],
            spu_id=monitor_spu.id,
            code="DEMO-SKU-MONITOR-002",
            name_zh="演示监护仪专业版",
            name_en="Demo Monitor Pro",
            product_model="DM-MONITOR-X1-PRO",
            has_plug=True,
            material="ABS+钢化玻璃",
        )
        summary["skus"]["created" if created else "reused"] += 1

        sku_ultrasound, created = await _ensure_sku(
            session,
            sku_service,
            users["product_user"],
            spu_id=ultrasound_spu.id,
            code="DEMO-SKU-ULTRASOUND-001",
            name_zh="演示便携彩超海外版",
            name_en="Demo Ultrasound Global",
            product_model="DM-ULTRA-P8-G",
            has_plug=False,
            material="镁铝合金",
        )
        summary["skus"]["created" if created else "reused"] += 1

        certificate_payloads = [
            CertificateCreate(
                name="演示 CE 证书（通用）",
                certificate_no="DEMO-CERT-CE-001",
                certificate_type="CE",
                issuing_authority="TUV Rheinland",
                valid_from=date.today() - timedelta(days=45),
                valid_to=date.today() + timedelta(days=365),
                ownership_type=CertificateOwnershipType.GENERAL,
                file_object_key="certificates/demo-ce-general.pdf",
                file_url=get_file_url("certificates/demo-ce-general.pdf"),
                file_name="demo-ce-general.pdf",
                remarks="用于通用列表演示",
            ),
            CertificateCreate(
                name="演示 FDA 证书（SPU归属）",
                certificate_no="DEMO-CERT-FDA-001",
                certificate_type="FDA",
                issuing_authority="FDA",
                valid_from=date.today() - timedelta(days=30),
                valid_to=date.today() + timedelta(days=180),
                ownership_type=CertificateOwnershipType.SPU,
                spu_ids=[monitor_spu.id],
                file_object_key="certificates/demo-fda-monitor.pdf",
                file_url=get_file_url("certificates/demo-fda-monitor.pdf"),
                file_name="demo-fda-monitor.pdf",
                remarks="绑定监护仪 SPU 的演示证书",
            ),
            CertificateCreate(
                name="演示 ISO13485 证书（分类归属）",
                certificate_no="DEMO-CERT-ISO-001",
                certificate_type="ISO13485",
                issuing_authority="SGS",
                valid_from=date.today() - timedelta(days=120),
                valid_to=date.today() + timedelta(days=25),
                ownership_type=CertificateOwnershipType.CATEGORY,
                category_ids=[ultrasound_tree[2].id],
                file_object_key="certificates/demo-iso-category.pdf",
                file_url=get_file_url("certificates/demo-iso-category.pdf"),
                file_name="demo-iso-category.pdf",
                remarks="即将过期，便于状态演示",
            ),
        ]
        for payload in certificate_payloads:
            created = await _ensure_certificate(
                session,
                certificate_service,
                users["product_user"],
                payload,
            )
            summary["certificates"]["created" if created else "reused"] += 1

        document_payloads = [
            ProductDocumentCreate(
                name="演示版产品手册-通用版",
                document_type="产品手册",
                content_html="<h3>演示产品手册</h3><p>用于列表、详情和预览交互演示。</p>",
                ownership_type=ProductDocumentOwnershipType.GENERAL,
                applicable_countries=["GLOBAL", "US", "DE"],
                attachments=[
                    ProductDocumentAttachmentInput(
                        object_key="product-documents/demo-general-manual.pdf",
                        file_url=get_file_url("product-documents/demo-general-manual.pdf"),
                        file_name="demo-general-manual.pdf",
                        sort_order=0,
                    )
                ],
                remarks="全局适用的演示手册",
            ),
            ProductDocumentCreate(
                name="演示版安装说明-监护仪专业版",
                document_type="安装说明",
                content_html="<p>适用于监护仪专业版 SKU 的安装指引。</p>",
                ownership_type=ProductDocumentOwnershipType.SKU,
                sku_ids=[sku_monitor_pro.id],
                applicable_countries=["CN", "US"],
                attachments=[
                    ProductDocumentAttachmentInput(
                        object_key="product-documents/demo-monitor-installation.pdf",
                        file_url=get_file_url("product-documents/demo-monitor-installation.pdf"),
                        file_name="demo-monitor-installation.pdf",
                        sort_order=0,
                    )
                ],
                remarks="指定 SKU 资料演示",
            ),
            ProductDocumentCreate(
                name="演示版培训资料-彩超系列",
                document_type="培训资料",
                content_html="<p>覆盖便携彩超系列培训话术与卖点整理。</p>",
                ownership_type=ProductDocumentOwnershipType.CATEGORY,
                category_ids=[ultrasound_tree[2].id],
                applicable_countries=["DE", "US"],
                attachments=[
                    ProductDocumentAttachmentInput(
                        object_key="product-documents/demo-ultrasound-training.pdf",
                        file_url=get_file_url("product-documents/demo-ultrasound-training.pdf"),
                        file_name="demo-ultrasound-training.pdf",
                        sort_order=0,
                    )
                ],
                remarks="分类归属资料演示",
            ),
        ]
        for payload in document_payloads:
            created = await _ensure_document(
                session,
                document_service,
                users["product_user"],
                payload,
            )
            summary["documents"]["created" if created else "reused"] += 1

        faq_payloads = [
            FAQCreate(
                question_type="使用",
                question="演示FAQ：这套产品支持哪些电压规格？",
                answer="默认支持 220V/50Hz，海外版可按国家配置不同电气规格。",
                attachment_object_key="faqs/demo-voltage-guide.pdf",
                attachment_file_url=get_file_url("faqs/demo-voltage-guide.pdf"),
                attachment_file_name="demo-voltage-guide.pdf",
            ),
            FAQCreate(
                spu_id=monitor_spu.id,
                question_type="售后",
                question="演示FAQ：监护仪专业版如何校准报警阈值？",
                answer="进入设备设置后选择报警管理，根据临床场景保存阈值模板即可。",
            ),
            FAQCreate(
                spu_id=ultrasound_spu.id,
                question_type="安装",
                question="演示FAQ：便携彩超首次开机需要做哪些检查？",
                answer="确认探头连接、电池电量和系统时间后，再执行首次自检流程。",
            ),
        ]
        for payload in faq_payloads:
            created = await _ensure_faq(
                session,
                faq_service,
                users["product_user"],
                payload,
            )
            summary["faqs"]["created" if created else "reused"] += 1

        price_payloads = [
            (
                sku_monitor_basic.id,
                [
                    PriceRegionPayload(currency="USD", sale_price="259.00", list_price="329.00"),
                    PriceRegionPayload(
                        country_code="CN",
                        country_name="中国",
                        currency="CNY",
                        sale_price="1880.00",
                        list_price="2080.00",
                        remarks="国内演示价",
                        sort_order=1,
                    ),
                ],
                PriceApprovalStatus.ACTIVE,
                None,
            ),
            (
                sku_monitor_pro.id,
                [
                    PriceRegionPayload(currency="USD", sale_price="319.00", list_price="399.00"),
                    PriceRegionPayload(
                        country_code="US",
                        country_name="美国",
                        currency="USD",
                        sale_price="329.00",
                        list_price="419.00",
                        remarks="待审批版本",
                        sort_order=1,
                    ),
                ],
                PriceApprovalStatus.PENDING,
                None,
            ),
            (
                sku_ultrasound.id,
                [
                    PriceRegionPayload(currency="EUR", sale_price="499.00", list_price="579.00"),
                    PriceRegionPayload(
                        country_code="DE",
                        country_name="德国",
                        currency="EUR",
                        sale_price="519.00",
                        list_price="599.00",
                        remarks="被驳回版本",
                        sort_order=1,
                    ),
                ],
                PriceApprovalStatus.REJECTED,
                "演示驳回：需补充德国市场税费说明后再提交。",
            ),
        ]
        for sku_id, regions, target_status, reject_reason in price_payloads:
            created = await _ensure_price(
                session,
                price_service,
                users["finance_user"],
                users["admin"],
                sku_id=sku_id,
                regions=regions,
                target_status=target_status,
                reject_reason=reject_reason,
            )
            summary["prices"]["created" if created else "reused"] += 1

        await session.commit()

    await engine.dispose()

    print("种子数据写入完成")
    for item in SEED_USERS:
        print(f"  {item['role'].value}: {item['username']} / {item['password']}")

    print("\n演示数据统计：")
    for key in (
        "users",
        "enums",
        "categories",
        "spus",
        "skus",
        "certificates",
        "documents",
        "faqs",
        "prices",
    ):
        created = summary[key]["created"]
        reused = summary[key]["reused"]
        print(f"  {key}: 新增 {created}，复用 {reused}")


if __name__ == "__main__":
    asyncio.run(seed())
