// 后续 Epic 2-4 将定义完整的产品类型
// 占位文件

export interface Category {
  id: number
  name: string
  parent_id: number | null
  level: number
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
