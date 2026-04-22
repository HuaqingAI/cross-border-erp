import apiClient from './client'
import type {
  PaginatedResult,
  PriceDetail,
  PriceListItem,
  PriceListQuery,
  PriceMutationPayload,
  PriceRejectPayload,
} from '../types/product'

export const pricesApi = {
  list: (params: PriceListQuery) =>
    apiClient
      .get<PaginatedResult<PriceListItem>>('/prices', { params })
      .then((response) => response.data),

  getById: (id: number) =>
    apiClient
      .get<PriceDetail>(`/prices/${id}`)
      .then((response) => response.data),

  getEffectiveBySku: (skuId: number) =>
    apiClient
      .get<PriceDetail>(`/prices/sku/${skuId}/effective`)
      .then((response) => response.data),

  create: (data: PriceMutationPayload) =>
    apiClient
      .post<PriceDetail>('/prices', data)
      .then((response) => response.data),

  update: (id: number, data: PriceMutationPayload) =>
    apiClient
      .patch<PriceDetail>(`/prices/${id}`, data)
      .then((response) => response.data),

  submit: (id: number) =>
    apiClient
      .post<PriceDetail>(`/prices/${id}/submit`)
      .then((response) => response.data),

  approve: (id: number) =>
    apiClient
      .post<PriceDetail>(`/prices/${id}/approve`)
      .then((response) => response.data),

  reject: (id: number, data: PriceRejectPayload) =>
    apiClient
      .post<PriceDetail>(`/prices/${id}/reject`, data)
      .then((response) => response.data),

  remove: (id: number) =>
    apiClient.delete<void>(`/prices/${id}`).then((response) => response.data),
}
