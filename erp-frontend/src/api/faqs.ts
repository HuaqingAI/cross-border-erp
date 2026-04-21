import apiClient from './client'
import type {
  Faq,
  FaqListItem,
  FaqListQuery,
  FaqMutationPayload,
  PaginatedResult,
} from '../types/product'

export const faqsApi = {
  list: (params: FaqListQuery) =>
    apiClient
      .get<PaginatedResult<FaqListItem>>('/faqs', { params })
      .then((response) => response.data),

  getById: (id: number) =>
    apiClient
      .get<Faq>(`/faqs/${id}`)
      .then((response) => response.data),

  create: (data: FaqMutationPayload) =>
    apiClient
      .post<Faq>('/faqs', data)
      .then((response) => response.data),

  update: (id: number, data: Partial<FaqMutationPayload>) =>
    apiClient
      .patch<Faq>(`/faqs/${id}`, data)
      .then((response) => response.data),

  remove: (id: number) =>
    apiClient
      .delete<void>(`/faqs/${id}`)
      .then((response) => response.data),
}
