import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,  // 必须：HTTP-only Cookie 认证
  headers: { 'Content-Type': 'application/json' },
})

// 响应拦截器：统一错误处理
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // TODO Story 1.2：跳转到登录页
    }
    return Promise.reject(error)
  }
)

export default apiClient
