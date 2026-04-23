from __future__ import annotations

from dataclasses import dataclass
import re

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessError, translate_integrity_error
from app.models.system_enum import SystemEnum
from app.repositories.enums import EnumRepository
from app.schemas.enums import EnumCreate, EnumGroupSummary, EnumItem, EnumUpdate


@dataclass(frozen=True)
class EnumGroupDefinition:
    key: str
    label: str
    description: str


SYSTEM_ENUM_GROUPS: tuple[EnumGroupDefinition, ...] = (
    EnumGroupDefinition("unit", "单位", "SPU、SKU 与开票等场景复用的计量单位"),
    EnumGroupDefinition("product_type", "产品类型", "SKU 产品类型，如主品、配件、耗材"),
    EnumGroupDefinition("product_status", "产品状态", "SKU 产品状态，如上架、下架可售等"),
    EnumGroupDefinition("package_type", "包装类型", "SKU 包装类型，如纸箱、木箱、托盘"),
    EnumGroupDefinition("electrical_params", "电参数", "电气规格，如 220V/50Hz"),
    EnumGroupDefinition("certificate_type", "证书类型", "产品证书类型，如 CE、FDA"),
    EnumGroupDefinition("faq_question_type", "FAQ问题类型", "FAQ 问题分类"),
    EnumGroupDefinition("document_type", "资料类型", "产品资料类型"),
    EnumGroupDefinition("currency", "币种", "价格相关币种"),
    EnumGroupDefinition("country_region", "国家/地区", "系统级国家/地区枚举，使用标准编码"),
)

SYSTEM_ENUM_GROUP_MAP = {group.key: group for group in SYSTEM_ENUM_GROUPS}
UPPERCASE_KEY_GROUPS = {"country_region", "currency"}
PROTECTED_ENUMS = {("country_region", "GLOBAL")}
COUNTRY_REGION_CODE_PATTERN = re.compile(r"^(?:[A-Z]{2}|GLOBAL)$")


class EnumService:
    DUPLICATE_MESSAGE = "同一枚举组下枚举编码不可重复"
    GROUP_NOT_FOUND_MESSAGE = "枚举组不存在"
    ENUM_NOT_FOUND_MESSAGE = "枚举值不存在"
    PROTECTED_DELETE_MESSAGE = "GLOBAL 为系统保留值，禁止删除"
    PROTECTED_DISABLE_MESSAGE = "GLOBAL 为系统保留值，禁止停用"
    PROTECTED_KEY_MESSAGE = "GLOBAL 为系统保留值，禁止修改编码"
    PROTECTED_VALUE_MESSAGE = "GLOBAL 为系统保留值，禁止修改显示值"
    COUNTRY_REGION_CODE_MESSAGE = "国家/地区编码必须为标准编码（如 CN、US、GLOBAL）"

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = EnumRepository(db)

    async def list_groups(self) -> list[EnumGroupSummary]:
        counts = await self.repo.count_by_group()
        return [
            EnumGroupSummary(
                key=group.key,
                label=group.label,
                description=group.description,
                total_count=counts.get(group.key, {}).get("total_count", 0),
                enabled_count=counts.get(group.key, {}).get("enabled_count", 0),
            )
            for group in SYSTEM_ENUM_GROUPS
        ]

    async def list_enums(
        self,
        enum_group: str,
        *,
        include_disabled: bool,
    ) -> list[EnumItem]:
        normalized_group = self._normalize_group(enum_group)
        items = await self.repo.list_by_group(
            normalized_group,
            include_disabled=include_disabled,
        )
        return [self._serialize(item) for item in items]

    async def create_enum(self, data: EnumCreate) -> EnumItem:
        normalized_group = self._normalize_group(data.enum_group)
        normalized_key = self._normalize_key(normalized_group, data.enum_key)

        existing = await self.repo.get_by_group_and_key(normalized_group, normalized_key)
        if existing is not None:
            raise BusinessError(self.DUPLICATE_MESSAGE)

        entity = SystemEnum(
            enum_group=normalized_group,
            enum_key=normalized_key,
            enum_value=data.enum_value,
            description=data.description,
            sort_order=data.sort_order,
            is_enabled=data.is_enabled,
        )
        try:
            await self.repo.save(entity)
        except IntegrityError as exc:
            await self.db.rollback()
            self._raise_translated_integrity_error(exc)
        return self._serialize(entity)

    async def update_enum(self, enum_id: int, data: EnumUpdate) -> EnumItem:
        entity = await self.repo.get_by_id(enum_id)
        if entity is None:
            raise BusinessError(self.ENUM_NOT_FOUND_MESSAGE, code="NOT_FOUND", status_code=404)

        target_key = (
            self._normalize_key(entity.enum_group, data.enum_key)
            if data.enum_key is not None
            else entity.enum_key
        )

        if self._is_protected(entity):
            if data.enum_key is not None and target_key != entity.enum_key:
                raise BusinessError(self.PROTECTED_KEY_MESSAGE)
            if data.enum_value is not None and data.enum_value != entity.enum_value:
                raise BusinessError(self.PROTECTED_VALUE_MESSAGE)
            if data.is_enabled is False:
                raise BusinessError(self.PROTECTED_DISABLE_MESSAGE)

        conflict = await self.repo.get_by_group_and_key(
            entity.enum_group,
            target_key,
            exclude_id=entity.id,
        )
        if conflict is not None:
            raise BusinessError(self.DUPLICATE_MESSAGE)

        if data.enum_key is not None:
            entity.enum_key = target_key
        if data.enum_value is not None:
            entity.enum_value = data.enum_value
        if data.description is not None or "description" in data.model_fields_set:
            entity.description = data.description
        if data.sort_order is not None:
            entity.sort_order = data.sort_order
        if data.is_enabled is not None:
            entity.is_enabled = data.is_enabled

        try:
            await self.repo.save(entity)
        except IntegrityError as exc:
            await self.db.rollback()
            self._raise_translated_integrity_error(exc)
        return self._serialize(entity)

    async def delete_enum(self, enum_id: int) -> None:
        entity = await self.repo.get_by_id(enum_id)
        if entity is None:
            raise BusinessError(self.ENUM_NOT_FOUND_MESSAGE, code="NOT_FOUND", status_code=404)
        if self._is_protected(entity):
            raise BusinessError(self.PROTECTED_DELETE_MESSAGE)
        await self.repo.soft_delete(entity)

    def _normalize_group(self, enum_group: str) -> str:
        normalized_group = enum_group.strip()
        if normalized_group not in SYSTEM_ENUM_GROUP_MAP:
            raise BusinessError(self.GROUP_NOT_FOUND_MESSAGE, code="NOT_FOUND", status_code=404)
        return normalized_group

    def _normalize_key(self, enum_group: str, enum_key: str) -> str:
        normalized_key = enum_key.strip()
        if not normalized_key:
            raise BusinessError("枚举编码不能为空")
        if enum_group in UPPERCASE_KEY_GROUPS:
            normalized_key = normalized_key.upper()
        if enum_group == "country_region" and not COUNTRY_REGION_CODE_PATTERN.fullmatch(normalized_key):
            raise BusinessError(self.COUNTRY_REGION_CODE_MESSAGE)
        return normalized_key

    def _is_protected(self, entity: SystemEnum) -> bool:
        return (entity.enum_group, entity.enum_key) in PROTECTED_ENUMS

    def _serialize(self, entity: SystemEnum) -> EnumItem:
        return EnumItem.model_validate(
            {
                "id": entity.id,
                "enum_group": entity.enum_group,
                "enum_key": entity.enum_key,
                "enum_value": entity.enum_value,
                "description": entity.description,
                "sort_order": entity.sort_order,
                "is_enabled": entity.is_enabled,
                "is_protected": self._is_protected(entity),
                "created_at": entity.created_at,
                "updated_at": entity.updated_at,
            }
        )

    def _raise_translated_integrity_error(self, exc: IntegrityError) -> None:
        translated = translate_integrity_error(exc)
        if translated is not None:
            raise translated
        raise exc
