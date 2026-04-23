from __future__ import annotations

from decimal import Decimal

import pytest

from app.core.exceptions import BusinessError
from app.models.price import Price, PriceRegion
from app.models.product_category import ProductCategory
from app.models.sku import SKU
from app.models.spu import SPU
from app.models.system_enum import SystemEnum
from app.schemas.price import PriceCreate, PriceRegionPayload
from app.services.prices import PriceService


def test_price_schema_normalizes_regions_and_defaults_global():
    payload = PriceCreate(
        sku_id=1,
        regions=[
            {
                "country_code": "  ",
                "country_name": "  ",
                "currency": " usd ",
                "sale_price": "199.00",
                "list_price": "299.00",
                "remarks": "  首发价  ",
            }
        ],
    )

    region = payload.regions[0]
    assert region.country_code == "GLOBAL"
    assert region.country_name == "全球"
    assert region.currency == "USD"
    assert region.remarks == "首发价"


@pytest.mark.asyncio
async def test_replace_regions_uses_latest_enum_label(db_session):
    price = Price(
        sku_id=1,
        sku_code="SKU-PRICE-LABEL",
        sku_name_zh="价格标签测试",
        sku_name_en="Price Label Test",
        spu_id=1,
        spu_code="SPU-PRICE-LABEL",
        spu_name="价格标签测试SPU",
        level1_category_id=1,
        level1_category_code="L1",
        level1_category_name="一级分类",
        level2_category_id=2,
        level2_category_code="L2",
        level2_category_name="二级分类",
        level3_category_id=3,
        level3_category_code="L3",
        level3_category_name="三级分类",
        purchase_price=Decimal("88.00"),
        supplier_name="供应商A",
        product_model="MODEL-A",
        product_status="上架",
    )
    db_session.add(price)
    db_session.add(
        SystemEnum(
            enum_group="country_region",
            enum_key="CN",
            enum_value="中国大陆",
            description="最新国家名称",
            sort_order=10,
            is_enabled=True,
        )
    )
    await db_session.commit()
    await db_session.refresh(price)

    service = PriceService(db_session)
    await service._replace_regions(
        price.id,
        [
            PriceRegionPayload(
                country_code="CN",
                country_name="中国",
                currency="CNY",
                sale_price=Decimal("199.00"),
                list_price=Decimal("299.00"),
            )
        ],
        version_stage=service.REGION_STAGE_DRAFT,
    )

    stored_regions = await service.repo.list_active_regions(
        price.id,
        version_stage=service.REGION_STAGE_DRAFT,
    )
    assert len(stored_regions) == 1
    assert stored_regions[0].country_name == "中国大陆"


@pytest.mark.asyncio
async def test_ensure_unique_regions_rejects_existing_conflict(db_session):
    level1 = ProductCategory(code="L1-PRICE", name="一级分类", level=1, parent_id=None, sort_order=1)
    db_session.add(level1)
    await db_session.flush()

    level2 = ProductCategory(code="L2-PRICE", name="二级分类", level=2, parent_id=level1.id, sort_order=1)
    db_session.add(level2)
    await db_session.flush()

    level3 = ProductCategory(code="L3-PRICE", name="三级分类", level=3, parent_id=level2.id, sort_order=1)
    db_session.add(level3)
    await db_session.flush()

    spu = SPU(
        code="SPU-PRICE-001",
        name="监护平台",
        level1_category_id=level1.id,
        level2_category_id=level2.id,
        level3_category_id=level3.id,
        customer_warranty_months=24,
        unit="台",
        restricted_countries=["US"],
        supplier_name="供应商A",
        manufacturer_model="MODEL-A",
        purchase_price=Decimal("88.00"),
        purchase_warranty_months=12,
        supplier_warranty_notes="标准质保",
    )
    db_session.add(spu)
    await db_session.flush()

    sku = SKU(
        spu_id=spu.id,
        code="SKU-PRICE-001",
        name_zh="监护平台标准版",
        name_en="Monitor Standard",
        product_model="SKU-MODEL-A",
        product_type="主品",
        level1_category_id=level1.id,
        level2_category_id=level2.id,
        level3_category_id=level3.id,
        supplier_name="供应商A",
        restricted_countries=["US"],
        customer_warranty_months=24,
        core_params="核心参数",
        product_status="上架",
        electrical_params=None,
        principle="工作原理",
        usage="临床用途",
        material="ABS",
        unit="台",
        has_plug=True,
        is_special=False,
        special_notes=None,
        package_type="纸箱",
        package_quantity=1,
        customs_hscode=None,
        customs_supervision_condition=None,
        customs_declaration_elements=None,
        customs_refund_tax_rate=None,
        customs_info_ready=False,
    )
    db_session.add(sku)
    await db_session.flush()

    price = Price(
        sku_id=sku.id,
        sku_code=sku.code,
        sku_name_zh=sku.name_zh,
        sku_name_en=sku.name_en,
        spu_id=spu.id,
        spu_code=spu.code,
        spu_name=spu.name,
        level1_category_id=level1.id,
        level1_category_code=level1.code,
        level1_category_name=level1.name,
        level2_category_id=level2.id,
        level2_category_code=level2.code,
        level2_category_name=level2.name,
        level3_category_id=level3.id,
        level3_category_code=level3.code,
        level3_category_name=level3.name,
        purchase_price=spu.purchase_price,
        supplier_name=sku.supplier_name,
        product_model=sku.product_model,
        product_status=sku.product_status,
    )
    db_session.add(price)
    await db_session.flush()

    region = PriceRegion(
        price_id=price.id,
        country_code="US",
        country_name="美国",
        currency="USD",
        sale_price=Decimal("199.00"),
        list_price=Decimal("299.00"),
        remarks=None,
        sort_order=0,
    )
    db_session.add(region)
    await db_session.commit()

    service = PriceService(db_session)
    with pytest.raises(BusinessError, match="同一 SKU 同一国家/地区不可重复设置价格"):
        await service._ensure_unique_regions(
            sku.id,
            [
                PriceRegionPayload(
                    country_code="US",
                    country_name="美国",
                    currency="USD",
                    sale_price=Decimal("188.00"),
                    list_price=Decimal("288.00"),
                )
            ],
        )


@pytest.mark.asyncio
async def test_ensure_unique_price_for_sku_rejects_existing_active_price(db_session):
    level1 = ProductCategory(code="L1-PRICE-2", name="一级分类", level=1, parent_id=None, sort_order=1)
    db_session.add(level1)
    await db_session.flush()

    level2 = ProductCategory(code="L2-PRICE-2", name="二级分类", level=2, parent_id=level1.id, sort_order=1)
    db_session.add(level2)
    await db_session.flush()

    level3 = ProductCategory(code="L3-PRICE-2", name="三级分类", level=3, parent_id=level2.id, sort_order=1)
    db_session.add(level3)
    await db_session.flush()

    spu = SPU(
        code="SPU-PRICE-002",
        name="输注平台",
        level1_category_id=level1.id,
        level2_category_id=level2.id,
        level3_category_id=level3.id,
        customer_warranty_months=24,
        unit="台",
        restricted_countries=["US"],
        supplier_name="供应商B",
        manufacturer_model="MODEL-B",
        purchase_price=Decimal("98.00"),
        purchase_warranty_months=12,
        supplier_warranty_notes="标准质保",
    )
    db_session.add(spu)
    await db_session.flush()

    sku = SKU(
        spu_id=spu.id,
        code="SKU-PRICE-002",
        name_zh="输注平台标准版",
        name_en="Infusion Standard",
        product_model="SKU-MODEL-B",
        product_type="主品",
        level1_category_id=level1.id,
        level2_category_id=level2.id,
        level3_category_id=level3.id,
        supplier_name="供应商B",
        restricted_countries=["US"],
        customer_warranty_months=24,
        core_params="核心参数",
        product_status="上架",
        electrical_params=None,
        principle="工作原理",
        usage="临床用途",
        material="ABS",
        unit="台",
        has_plug=True,
        is_special=False,
        special_notes=None,
        package_type="纸箱",
        package_quantity=1,
        customs_hscode=None,
        customs_supervision_condition=None,
        customs_declaration_elements=None,
        customs_refund_tax_rate=None,
        customs_info_ready=False,
    )
    db_session.add(sku)
    await db_session.flush()

    price = Price(
        sku_id=sku.id,
        sku_code=sku.code,
        sku_name_zh=sku.name_zh,
        sku_name_en=sku.name_en,
        spu_id=spu.id,
        spu_code=spu.code,
        spu_name=spu.name,
        level1_category_id=level1.id,
        level1_category_code=level1.code,
        level1_category_name=level1.name,
        level2_category_id=level2.id,
        level2_category_code=level2.code,
        level2_category_name=level2.name,
        level3_category_id=level3.id,
        level3_category_code=level3.code,
        level3_category_name=level3.name,
        purchase_price=spu.purchase_price,
        supplier_name=sku.supplier_name,
        product_model=sku.product_model,
        product_status=sku.product_status,
    )
    db_session.add(price)
    await db_session.commit()

    service = PriceService(db_session)
    with pytest.raises(BusinessError, match="该SKU已存在价格记录"):
        await service._ensure_unique_price_for_sku(sku.id)
