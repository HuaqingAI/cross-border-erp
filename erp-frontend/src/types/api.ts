// 与后端 common.py 保持一致

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface ErrorDetail {
  field?: string
  msg: string
}

export interface ErrorResponse {
  code: string
  message: string
  details?: ErrorDetail[]
}
