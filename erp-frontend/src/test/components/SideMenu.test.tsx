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
})
