import { useAuthStore } from '../stores/authStore'
import type { UserRole } from '../types/auth'

export interface Permission {
  // 菜单可见性（Story 1.4 使用）
  canAccessImport: boolean       // 数据导入：产品部 + 管理员
  canAccessAdminConfig: boolean  // 系统配置/枚举管理：管理员专属
  // 按钮/操作级权限（后续 Story 使用）
  canCreateProduct: boolean      // 产品写操作：产品部 + 管理员
  canEditCustomsInfo: boolean    // 报关信息编辑：商务部 + 管理员
  canManagePrice: boolean        // 价格管理写操作：财务部 + 管理员
  canViewPurchasePrice: boolean  // 采购价可见：产品部 + 财务部 + 管理员
}

export function usePermission(): Permission {
  const user = useAuthStore((s) => s.user)
  const role = (user?.role ?? '') as UserRole

  return {
    canAccessImport: role === 'product_dept' || role === 'admin',
    canAccessAdminConfig: role === 'admin',
    canCreateProduct: role === 'product_dept' || role === 'admin',
    canEditCustomsInfo: role === 'business_dept' || role === 'admin',
    canManagePrice: role === 'finance_dept' || role === 'admin',
    canViewPurchasePrice:
      role === 'product_dept' || role === 'finance_dept' || role === 'admin',
  }
}
