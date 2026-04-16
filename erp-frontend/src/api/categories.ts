import apiClient from './client'
import type {
  CategoryTreeNode,
  CategoryMutationPayload,
  CategorySortPayload,
  ProductCategory,
} from '../types/product'

export const categoriesApi = {
  getTree: () =>
    apiClient
      .get<CategoryTreeNode[]>('/products/categories/tree')
      .then((response) => response.data),

  create: (data: CategoryMutationPayload) =>
    apiClient
      .post<ProductCategory>('/products/categories', data)
      .then((response) => response.data),

  update: (id: number, data: Pick<CategoryMutationPayload, 'name'>) =>
    apiClient
      .patch<ProductCategory>(`/products/categories/${id}`, data)
      .then((response) => response.data),

  updateSort: (id: number, data: CategorySortPayload) =>
    apiClient
      .patch<ProductCategory>(`/products/categories/${id}/sort`, data)
      .then((response) => response.data),

  remove: (id: number) =>
    apiClient
      .delete<{ message: string }>(`/products/categories/${id}`)
      .then((response) => response.data),
}
