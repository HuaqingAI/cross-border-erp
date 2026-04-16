from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessError
from app.models.product_category import ProductCategory
from app.repositories.product_categories import ProductCategoryRepository
from app.schemas.product_category import (
    ProductCategoryCreate,
    ProductCategorySortUpdate,
    ProductCategoryTreeNode,
    ProductCategoryUpdate,
)


class ProductCategoryService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ProductCategoryRepository(db)

    async def get_tree(self) -> list[ProductCategoryTreeNode]:
        categories = await self.repo.list_tree_nodes()
        nodes = {
            category.id: ProductCategoryTreeNode(
                id=category.id,
                code=category.code,
                name=category.name,
                level=category.level,
                parent_id=category.parent_id,
                sort_order=category.sort_order,
                children=[],
            )
            for category in categories
        }

        roots: list[ProductCategoryTreeNode] = []
        for category in categories:
            node = nodes[category.id]
            if category.parent_id is None:
                roots.append(node)
            else:
                parent = nodes.get(category.parent_id)
                if parent is not None:
                    parent.children.append(node)
        return roots

    async def create_category(self, data: ProductCategoryCreate) -> ProductCategory:
        existing = await self.repo.get_by_code_including_deleted(data.code)
        if existing and existing.deleted_at is None:
            raise BusinessError("分类编码已存在")

        level = 1
        if data.parent_id is not None:
            parent = await self.repo.get_by_id(data.parent_id)
            if parent is None:
                raise BusinessError("父级分类不存在")
            if parent.level >= 3:
                raise BusinessError("三级分类下不可继续创建子分类")
            level = parent.level + 1

        sort_order = data.sort_order
        if sort_order is None:
            sort_order = await self.repo.get_next_sort_order(data.parent_id)

        if existing and existing.deleted_at is not None:
            category = existing
            category.deleted_at = None
            category.name = data.name
            category.level = level
            category.parent_id = data.parent_id
            category.sort_order = sort_order
        else:
            category = ProductCategory(
                code=data.code,
                name=data.name,
                level=level,
                parent_id=data.parent_id,
                sort_order=sort_order,
            )
        return await self.repo.save(category)

    async def update_category(
        self,
        category_id: int,
        data: ProductCategoryUpdate,
    ) -> ProductCategory:
        category = await self._get_required_category(category_id)

        if data.code is not None and data.code != category.code:
            raise BusinessError("分类编码创建后不可修改")

        if data.name is not None:
            category.name = data.name
        if data.sort_order is not None:
            category.sort_order = data.sort_order

        return await self.repo.save(category)

    async def update_sort(
        self,
        category_id: int,
        data: ProductCategorySortUpdate,
    ) -> ProductCategory:
        category = await self._get_required_category(category_id)
        category.sort_order = data.sort_order
        return await self.repo.save(category)

    async def delete_category(self, category_id: int) -> None:
        categories = await self.repo.list_subtree(category_id)
        if not categories:
            raise BusinessError("分类不存在", code="NOT_FOUND", status_code=404)

        category_ids = [category.id for category in categories]
        if await self._has_linked_products(category_ids):
            raise BusinessError("该分类下已有产品关联，无法删除")

        for category in reversed(categories):
            await self.repo.soft_delete(category)

    async def _get_required_category(self, category_id: int) -> ProductCategory:
        category = await self.repo.get_by_id(category_id)
        if category is None:
            raise BusinessError("分类不存在", code="NOT_FOUND", status_code=404)
        return category

    async def _has_linked_products(self, category_ids: list[int]) -> bool:
        return await self.repo.has_linked_spus_in_categories(category_ids)
