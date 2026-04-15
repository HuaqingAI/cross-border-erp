import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAuthStore } from '../stores/authStore'
import { usePermission } from '../hooks/usePermission'
import type { User } from '../types/auth'

function setUser(user: User | null) {
  useAuthStore.setState({ user, isAuthenticated: user !== null })
}

beforeEach(() => {
  setUser(null)
})

describe('usePermission', () => {
  it('admin has all permissions', () => {
    setUser({ id: 1, username: 'admin', role: 'admin' })
    const { result } = renderHook(() => usePermission())

    expect(result.current.canAccessImport).toBe(true)
    expect(result.current.canAccessAdminConfig).toBe(true)
    expect(result.current.canCreateProduct).toBe(true)
    expect(result.current.canEditCustomsInfo).toBe(true)
    expect(result.current.canManagePrice).toBe(true)
    expect(result.current.canViewPurchasePrice).toBe(true)
  })

  it('product_dept has product and import permissions', () => {
    setUser({ id: 2, username: 'product', role: 'product_dept' })
    const { result } = renderHook(() => usePermission())

    expect(result.current.canAccessImport).toBe(true)
    expect(result.current.canAccessAdminConfig).toBe(false)
    expect(result.current.canCreateProduct).toBe(true)
    expect(result.current.canEditCustomsInfo).toBe(false)
    expect(result.current.canManagePrice).toBe(false)
    expect(result.current.canViewPurchasePrice).toBe(true)
  })

  it('business_dept can only edit customs info', () => {
    setUser({ id: 3, username: 'biz', role: 'business_dept' })
    const { result } = renderHook(() => usePermission())

    expect(result.current.canAccessImport).toBe(false)
    expect(result.current.canAccessAdminConfig).toBe(false)
    expect(result.current.canCreateProduct).toBe(false)
    expect(result.current.canEditCustomsInfo).toBe(true)
    expect(result.current.canManagePrice).toBe(false)
    expect(result.current.canViewPurchasePrice).toBe(false)
  })

  it('finance_dept can manage price and view purchase price', () => {
    setUser({ id: 4, username: 'finance', role: 'finance_dept' })
    const { result } = renderHook(() => usePermission())

    expect(result.current.canAccessImport).toBe(false)
    expect(result.current.canAccessAdminConfig).toBe(false)
    expect(result.current.canCreateProduct).toBe(false)
    expect(result.current.canEditCustomsInfo).toBe(false)
    expect(result.current.canManagePrice).toBe(true)
    expect(result.current.canViewPurchasePrice).toBe(true)
  })

  it('unauthenticated user has no permissions', () => {
    setUser(null)
    const { result } = renderHook(() => usePermission())

    expect(result.current.canAccessImport).toBe(false)
    expect(result.current.canAccessAdminConfig).toBe(false)
    expect(result.current.canCreateProduct).toBe(false)
    expect(result.current.canEditCustomsInfo).toBe(false)
    expect(result.current.canManagePrice).toBe(false)
    expect(result.current.canViewPurchasePrice).toBe(false)
  })
})
