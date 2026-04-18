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

export interface SpuInvoiceInfo {
  id?: number
  invoice_name: string
  invoice_unit: string
  invoice_model: string
  company_subject: string
  sort_order: number
}

export interface Spu extends SpuListItem {
  purchase_warranty_months?: number | null
  supplier_warranty_notes?: string | null
  restricted_countries?: string[]
  invoice_infos?: SpuInvoiceInfo[]
  updated_at?: string
}

export interface SpuMutationPayload {
  code?: string
  name: string
  level1_category_id: number
  level2_category_id: number
  level3_category_id: number
  customer_warranty_months: number
  unit: string
  restricted_countries: string[]
  supplier_name: string
  manufacturer_model: string
  purchase_price?: number | null
  purchase_warranty_months?: number | null
  supplier_warranty_notes?: string | null
  invoice_infos: SpuInvoiceInfo[]
}

export interface Sku {
  id: number
  spu_id: number
  spu_code: string
  spu_name: string
  code: string
  name_zh: string
  name_en: string
  product_model: string
  product_type: SkuProductType
  level1_category_id: number
  level2_category_id: number
  level3_category_id: number
  supplier_name: string
  restricted_countries: string[]
  customer_warranty_months: number
  core_params: string
  product_status: SkuProductStatus
  electrical_params?: string | null
  principle: string
  usage: string
  material?: string | null
  unit: string
  has_plug: boolean
  is_special: boolean
  special_notes?: string | null
  package_type?: string | null
  package_quantity?: number | null
  package_details: SkuPackageDetail[]
  images: SkuImage[]
  customs_hscode?: string | null
  customs_supervision_condition?: string | null
  customs_declaration_elements?: string | null
  customs_refund_tax_rate?: string | null
  customs_info_ready: boolean
  created_at: string
  updated_at: string
}

export type SkuProductType = '主品' | '配件' | '耗材'

export type SkuProductStatus = '上架' | '下架可售' | '下架不可售' | '临拓'

export interface SkuListItem {
  id: number
  spu_id: number
  spu_code: string
  spu_name: string
  code: string
  name_zh: string
  name_en: string
  product_model: string
  product_type: SkuProductType
  level1_category_id: number
  level2_category_id: number
  level3_category_id: number
  supplier_name: string
  product_status: SkuProductStatus
  customer_warranty_months: number
  created_at: string
}

export interface SkuListQuery {
  page: number
  page_size: number
  spu_id?: number
  level1_category_id?: number
  level2_category_id?: number
  level3_category_id?: number
  supplier_name?: string
  product_status?: SkuProductStatus
  product_type?: SkuProductType
  keyword?: string
}

export interface SkuPackageDetail {
  id: number
  net_weight_kg?: string | null
  gross_weight_kg?: string | null
  length_cm?: string | null
  width_cm?: string | null
  height_cm?: string | null
  volume_cbm?: string | null
  sort_order: number
}

export interface SkuImage {
  id: number
  object_key: string
  file_url: string
  filename: string
  content_type: string
  sort_order: number
}
