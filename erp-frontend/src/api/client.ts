import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../stores/authStore'

const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // 必须：HTTP-only Cookie 认证
  headers: { 'Content-Type': 'application/json' },
})

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

let refreshPromise: Promise<void> | null = null

async function refreshAccessToken(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        '/api/v1/auth/refresh',
        undefined,
        {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' },
        },
      )
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

function redirectToLogin() {
  useAuthStore.getState().logout()
  window.location.href = '/login'
}

// 响应拦截器：401 时优先尝试刷新 access_token，刷新失败后再回登录页。
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const originalRequest = error.config as RetriableRequestConfig | undefined
    const url: string = originalRequest?.url ?? ''
    const isAuthRequest =
      url.includes('/auth/login') || url.includes('/auth/refresh')

    if (status === 401 && !isAuthRequest && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        await refreshAccessToken()
        return apiClient(originalRequest)
      } catch {
        redirectToLogin()
        return Promise.reject(error)
      }
    }

    if (status === 401 && !isAuthRequest) {
      redirectToLogin()
    }

    return Promise.reject(error)
  }
)

export default apiClient
