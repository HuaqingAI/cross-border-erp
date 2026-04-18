import apiClient from './client'
import type { PaginatedResult, Sku, SkuListItem, SkuListQuery } from '../types/product'

export const skusApi = {
  list: (params: SkuListQuery) =>
    apiClient
      .get<PaginatedResult<SkuListItem>>('/skus', { params })
      .then((response) => response.data),

  getById: (id: number) =>
    apiClient
      .get<Sku>(`/skus/${id}`)
      .then((response) => response.data),
}
