import apiClient from './client'
import type { LoginRequest, LoginResponse, User } from '../types/auth'

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', data).then((r) => r.data),

  logout: () =>
    apiClient.post<{ message: string }>('/auth/logout').then((r) => r.data),

  refresh: () =>
    apiClient.post<{ message: string }>('/auth/refresh').then((r) => r.data),

  getMe: () =>
    apiClient.get<User>('/auth/me').then((r) => r.data),
}
