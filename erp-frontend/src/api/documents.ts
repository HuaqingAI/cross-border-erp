import apiClient from './client'
import type {
  Document,
  DocumentListItem,
  DocumentListQuery,
  DocumentMutationPayload,
  PaginatedResult,
} from '../types/product'

export const documentsApi = {
  list: (params: DocumentListQuery) =>
    apiClient
      .get<PaginatedResult<DocumentListItem>>('/products/documents', { params })
      .then((response) => response.data),

  getById: (id: number) =>
    apiClient
      .get<Document>(`/products/documents/${id}`)
      .then((response) => response.data),

  create: (data: DocumentMutationPayload) =>
    apiClient
      .post<Document>('/products/documents', data)
      .then((response) => response.data),

  update: (id: number, data: Partial<DocumentMutationPayload>) =>
    apiClient
      .patch<Document>(`/products/documents/${id}`, data)
      .then((response) => response.data),

  remove: (id: number) =>
    apiClient
      .delete<void>(`/products/documents/${id}`)
      .then((response) => response.data),
}
