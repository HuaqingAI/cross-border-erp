import apiClient from './client'
import type {
  Certificate,
  CertificateListItem,
  CertificateListQuery,
  CertificateMutationPayload,
  PaginatedResult,
} from '../types/product'

export const certificatesApi = {
  list: (params: CertificateListQuery) =>
    apiClient
      .get<PaginatedResult<CertificateListItem>>('/certificates', { params })
      .then((response) => response.data),

  getById: (id: number) =>
    apiClient
      .get<Certificate>(`/certificates/${id}`)
      .then((response) => response.data),

  create: (data: CertificateMutationPayload) =>
    apiClient
      .post<Certificate>('/certificates', data)
      .then((response) => response.data),

  update: (id: number, data: Partial<CertificateMutationPayload>) =>
    apiClient
      .patch<Certificate>(`/certificates/${id}`, data)
      .then((response) => response.data),

  remove: (id: number) =>
    apiClient.delete<void>(`/certificates/${id}`).then((response) => response.data),
}
