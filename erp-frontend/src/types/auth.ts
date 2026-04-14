// Story 1.2 将定义完整的认证类型
// 占位文件

export interface User {
  id: number
  username: string
  email: string
  role: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}
