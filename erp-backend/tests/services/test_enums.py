from __future__ import annotations

import pytest

from app.core.exceptions import BusinessError
from app.models.system_enum import SystemEnum
from app.schemas.enums import EnumCreate, EnumUpdate
from app.services.enums import EnumService


def test_enum_schema_normalizes_text_fields():
    payload = EnumCreate(
        enum_group=" country_region ",
        enum_key=" us ",
        enum_value=" 美国 ",
        description=" 北美区域 ",
    )

    assert payload.enum_group == "country_region"
    assert payload.enum_key == "us"
    assert payload.enum_value == "美国"
    assert payload.description == "北美区域"


@pytest.mark.asyncio
async def test_service_uppercases_currency_and_country_region_keys(db_session):
    service = EnumService(db_session)

    currency = await service.create_enum(
        EnumCreate(
            enum_group="currency",
            enum_key=" usd ",
            enum_value="美元",
            sort_order=10,
            is_enabled=True,
        )
    )
    country = await service.create_enum(
        EnumCreate(
            enum_group="country_region",
            enum_key=" cn ",
            enum_value="中国",
            sort_order=20,
            is_enabled=True,
        )
    )

    assert currency.enum_key == "USD"
    assert country.enum_key == "CN"


@pytest.mark.asyncio
async def test_service_rejects_disabling_global(db_session):
    entity = SystemEnum(
        enum_group="country_region",
        enum_key="GLOBAL",
        enum_value="全球",
        description="系统保留默认区域",
        sort_order=0,
        is_enabled=True,
    )
    db_session.add(entity)
    await db_session.commit()
    await db_session.refresh(entity)

    service = EnumService(db_session)

    with pytest.raises(BusinessError, match="GLOBAL 为系统保留值，禁止停用"):
        await service.update_enum(entity.id, EnumUpdate(is_enabled=False))


@pytest.mark.asyncio
async def test_service_rejects_non_standard_country_region_code(db_session):
    service = EnumService(db_session)

    with pytest.raises(BusinessError, match="国家/地区编码必须为标准编码"):
        await service.create_enum(
            EnumCreate(
                enum_group="country_region",
                enum_key="CN-TEST",
                enum_value="测试区域",
                sort_order=10,
                is_enabled=True,
            )
        )


@pytest.mark.asyncio
async def test_service_rejects_renaming_global_value(db_session):
    entity = SystemEnum(
        enum_group="country_region",
        enum_key="GLOBAL",
        enum_value="全球",
        description="系统保留默认区域",
        sort_order=0,
        is_enabled=True,
    )
    db_session.add(entity)
    await db_session.commit()
    await db_session.refresh(entity)

    service = EnumService(db_session)

    with pytest.raises(BusinessError, match="GLOBAL 为系统保留值，禁止修改显示值"):
        await service.update_enum(entity.id, EnumUpdate(enum_value="全区域"))
