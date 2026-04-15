export type UserRole = 'admin' | 'product_dept' | 'business_dept' | 'finance_dept'

export interface User {
  id: number
  username: string
  role: UserRole
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  user: User
  message: string
}
