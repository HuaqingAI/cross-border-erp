import type React from 'react'

export interface MenuItem {
  key: string       // 路由路径
  label: string     // 显示名称
  icon?: React.ReactNode
  children?: MenuItem[]
  requiredPermission?: 'canAccessImport' | 'canAccessAdminConfig'
}
