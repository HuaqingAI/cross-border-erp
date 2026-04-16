export interface Category {
  id: number
  name: string
  parent_id: number | null
  level: number
}

export interface ProductCategory extends Category {
  code: string
  sort_order: number
}

export interface CategoryTreeNode extends ProductCategory {
  children: CategoryTreeNode[]
}

export interface CategoryMutationPayload {
  code: string
  name: string
  parent_id?: number
  sort_order?: number
}

export interface CategorySortPayload {
  sort_order: number
}

export interface Spu {
  id: number
  name: string
  category_id: number
  status: string
}

export interface Sku {
  id: number
  spu_id: number
  sku_code: string
  name: string
  status: string
}
