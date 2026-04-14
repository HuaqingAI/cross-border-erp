// Story 1.2 将实现认证 API
// 占位文件

import apiClient from './client'
import type { LoginRequest, TokenResponse, User } from '../types/auth'

export const authApi = {
  login: (_data: LoginRequest): Promise<TokenResponse> => {
    throw new Error('Story 1.2 将实现此方法')
  },

  logout: (): Promise<void> => {
    throw new Error('Story 1.2 将实现此方法')
  },

  getCurrentUser: (): Promise<User> => {
    return apiClient.get<User>('/auth/me').then((r) => r.data)
  },
}
