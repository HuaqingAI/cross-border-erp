import apiClient from './client'
import type {
  PaginatedResult,
  Sku,
  SkuCustomsInfoPayload,
  SkuImageCreatePayload,
  SkuListItem,
  SkuListQuery,
  SkuMutationPayload,
} from '../types/product'

export const skusApi = {
  list: (params: SkuListQuery) =>
    apiClient
      .get<PaginatedResult<SkuListItem>>('/skus', { params })
      .then((response) => response.data),

  getById: (id: number) =>
    apiClient
      .get<Sku>(`/skus/${id}`)
      .then((response) => response.data),

  create: (data: SkuMutationPayload) =>
    apiClient
      .post<Sku>('/skus', data)
      .then((response) => response.data),

  update: (id: number, data: Partial<Omit<SkuMutationPayload, 'code'>>) =>
    apiClient
      .patch<Sku>(`/skus/${id}`, data)
      .then((response) => response.data),

  updateCustomsInfo: (id: number, data: SkuCustomsInfoPayload) =>
    apiClient
      .patch<Sku>(`/skus/${id}/customs-info`, data)
      .then((response) => response.data),

  addImage: (id: number, data: SkuImageCreatePayload) =>
    apiClient
      .post<Sku>(`/skus/${id}/images`, data)
      .then((response) => response.data),

  deleteImage: (id: number, imageId: number) =>
    apiClient
      .delete<Sku>(`/skus/${id}/images/${imageId}`)
      .then((response) => response.data),
}
