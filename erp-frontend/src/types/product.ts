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

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface SpuListItem {
  id: number
  code: string
  name: string
  level1_category_id: number
  level2_category_id: number
  level3_category_id: number
  supplier_name: string
  customer_warranty_months: number
  unit: string
  manufacturer_model: string
  created_at: string
  purchase_price?: string | null
  sku_count?: number | null
}

export interface SpuListQuery {
  page: number
  page_size: number
  level1_category_id?: number
  level2_category_id?: number
  level3_category_id?: number
  supplier_name?: string
  keyword?: string
}

export interface Spu extends SpuListItem {
  purchase_warranty_months?: number | null
  supplier_warranty_notes?: string | null
  restricted_countries?: string[]
}

export interface Sku {
  id: number
  spu_id: number
  sku_code: string
  name: string
  status: string
}
