import { describe, expect, it } from 'vitest'
import { resolveTabLabel } from '../../components/layout/SideMenu'

describe('resolveTabLabel', () => {
  it('为 SKU 新增路由返回正确标题', () => {
    expect(resolveTabLabel('/products/skus/new')).toBe('新增SKU')
  })

  it('为 SKU 详情路由返回正确标题', () => {
    expect(resolveTabLabel('/products/skus/201')).toBe('SKU详情')
  })

  it('为 SKU 编辑路由返回正确标题', () => {
    expect(resolveTabLabel('/products/skus/201/edit')).toBe('编辑SKU')
  })

  it('为证书新增路由返回正确标题', () => {
    expect(resolveTabLabel('/products/certificates/new')).toBe('新增证书')
  })

  it('为证书详情路由返回正确标题', () => {
    expect(resolveTabLabel('/products/certificates/12')).toBe('证书详情')
  })

  it('为证书编辑路由返回正确标题', () => {
    expect(resolveTabLabel('/products/certificates/12/edit')).toBe('编辑证书')
  })

  it('为价格新增路由返回正确标题', () => {
    expect(resolveTabLabel('/prices/new')).toBe('新增价格')
  })

  it('为价格详情路由返回正确标题', () => {
    expect(resolveTabLabel('/prices/301')).toBe('价格详情')
  })

  it('为价格编辑路由返回正确标题', () => {
    expect(resolveTabLabel('/prices/301/edit')).toBe('编辑价格')
  })
})
