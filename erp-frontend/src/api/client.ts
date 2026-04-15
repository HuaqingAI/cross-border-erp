import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // 必须：HTTP-only Cookie 认证
  headers: { 'Content-Type': 'application/json' },
})

// 响应拦截器：401 跳转到登录页（排除 login/refresh 自身）
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const url: string = error.config?.url ?? ''

    if (
      status === 401 &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/refresh')
    ) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
