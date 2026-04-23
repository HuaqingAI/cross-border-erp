import apiClient from './client'
import type {
  SystemEnumCreatePayload,
  SystemEnumGroupSummary,
  SystemEnumItem,
  SystemEnumListQuery,
  SystemEnumUpdatePayload,
} from '../types/product'

export const enumsApi = {
  listGroups: () =>
    apiClient
      .get<SystemEnumGroupSummary[]>('/enums/groups')
      .then((response) => response.data),

  list: (params: SystemEnumListQuery) =>
    apiClient
      .get<SystemEnumItem[]>('/enums', { params })
      .then((response) => response.data),

  create: (data: SystemEnumCreatePayload) =>
    apiClient
      .post<SystemEnumItem>('/enums', data)
      .then((response) => response.data),

  update: (id: number, data: SystemEnumUpdatePayload) =>
    apiClient
      .patch<SystemEnumItem>(`/enums/${id}`, data)
      .then((response) => response.data),

  remove: (id: number) =>
    apiClient.delete<void>(`/enums/${id}`).then((response) => response.data),
}
