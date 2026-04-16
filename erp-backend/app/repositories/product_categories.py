from sqlalchemy import MetaData, Select, Table, func, inspect, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product_category import ProductCategory
from app.repositories.base_repository import BaseRepository


class ProductCategoryRepository(BaseRepository[ProductCategory]):
    def __init__(self, db: AsyncSession):
        super().__init__(ProductCategory, db)

    async def get_by_code(self, code: str) -> ProductCategory | None:
        result = await self.db.execute(
            select(self.model).where(
                self.model.code == code,
                self.model.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_tree_nodes(self) -> list[ProductCategory]:
        result = await self.db.execute(
            select(self.model)
            .where(self.model.deleted_at.is_(None))
            .order_by(self.model.level, self.model.sort_order, self.model.id)
        )
        return list(result.scalars().all())

    async def list_children(self, parent_id: int) -> list[ProductCategory]:
        result = await self.db.execute(
            select(self.model).where(
                self.model.parent_id == parent_id,
                self.model.deleted_at.is_(None),
            )
        )
        return list(result.scalars().all())

    async def has_children(self, category_id: int) -> bool:
        result = await self.db.execute(
            select(func.count(self.model.id)).where(
                self.model.parent_id == category_id,
                self.model.deleted_at.is_(None),
            )
        )
        return (result.scalar_one() or 0) > 0

    async def get_next_sort_order(self, parent_id: int | None) -> int:
        stmt: Select[tuple[int | None]] = select(func.max(self.model.sort_order)).where(
            self.model.deleted_at.is_(None)
        )
        if parent_id is None:
            stmt = stmt.where(self.model.parent_id.is_(None))
        else:
            stmt = stmt.where(self.model.parent_id == parent_id)

        result = await self.db.execute(stmt)
        max_sort = result.scalar_one()
        return (max_sort or 0) + 1

    async def has_linked_spus(self, category_id: int) -> bool:
        spus_table = await self._load_table("spus")
        if spus_table is None:
            return False

        candidate_columns = [
            "category_id",
            "level1_category_id",
            "level2_category_id",
            "level3_category_id",
            "category_level1_id",
            "category_level2_id",
            "category_level3_id",
            "first_category_id",
            "second_category_id",
            "third_category_id",
        ]
        filters = [
            spus_table.c[column_name] == category_id
            for column_name in candidate_columns
            if column_name in spus_table.c
        ]
        if not filters:
            return False

        stmt = select(func.count()).select_from(spus_table).where(or_(*filters))
        if "deleted_at" in spus_table.c:
            stmt = stmt.where(spus_table.c.deleted_at.is_(None))

        result = await self.db.execute(stmt)
        return (result.scalar_one() or 0) > 0

    async def _load_table(self, table_name: str) -> Table | None:
        connection = await self.db.connection()

        def _reflect(sync_connection):
            inspector = inspect(sync_connection)
            if table_name not in inspector.get_table_names():
                return None
            metadata = MetaData()
            return Table(table_name, metadata, autoload_with=sync_connection)

        return await connection.run_sync(_reflect)
