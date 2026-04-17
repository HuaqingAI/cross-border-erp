import apiClient from './client'
import type { PaginatedResult, SpuListItem, SpuListQuery } from '../types/product'

export const spusApi = {
  list: (params: SpuListQuery) =>
    apiClient
      .get<PaginatedResult<SpuListItem>>('/spus', { params })
      .then((response) => response.data),
}
