import apiClient from './client'
import type {
  PaginatedResult,
  Spu,
  SpuListItem,
  SpuListQuery,
  SpuMutationPayload,
} from '../types/product'

export const spusApi = {
  list: (params: SpuListQuery) =>
    apiClient
      .get<PaginatedResult<SpuListItem>>('/spus', { params })
      .then((response) => response.data),

  getById: (id: number) =>
    apiClient
      .get<Spu>(`/spus/${id}`)
      .then((response) => response.data),

  create: (data: SpuMutationPayload) =>
    apiClient
      .post<Spu>('/spus', data)
      .then((response) => response.data),

  update: (id: number, data: Omit<SpuMutationPayload, 'code'>) =>
    apiClient
      .patch<Spu>(`/spus/${id}`, data)
      .then((response) => response.data),
}
