import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SKUListPage, { buildQueryParams } from '../../features/products/skus/pages/SKUListPage'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import type { CategoryTreeNode, PaginatedResult, SkuListItem, SystemEnumItem } from '../../types/product'

const navigate = vi.fn()

const categoryTree: CategoryTreeNode[] = [
  {
    id: 1,
    code: 'MED',
    name: '医疗设备',
    level: 1,
    parent_id: null,
    sort_order: 10,
    children: [
      {
        id: 2,
        code: 'IMG',
        name: '影像设备',
        level: 2,
        parent_id: 1,
        sort_order: 10,
        children: [
          {
            id: 3,
            code: 'ULT',
            name: '超声设备',
            level: 3,
            parent_id: 2,
            sort_order: 10,
            children: [],
          },
        ],
      },
    ],
  },
]

const skuItems: SkuListItem[] = [
  {
    id: 201,
    spu_id: 101,
    spu_code: 'SPU001',
    spu_name: '超声平台',
    code: 'SKU001',
    name_zh: '超声刀 Alpha',
    name_en: 'Alpha Ultrasound',
    product_model: 'M-100',
    product_type: '主品',
    level1_category_id: 1,
    level2_category_id: 2,
    level3_category_id: 3,
    supplier_name: '供应商甲',
    product_status: '下架不可售',
    customer_warranty_months: 24,
    created_at: '2026-04-18T09:00:00Z',
  },
]

const list = vi.fn()

function enumItem(group: string, key: string, value: string, isEnabled = true): SystemEnumItem {
  return {
    id: Number(`${group.length}${key.length}${value.length}`),
    enum_group: group,
    enum_key: key,
    enum_value: value,
    description: null,
    sort_order: 10,
    is_enabled: isEnabled,
    is_protected: false,
    created_at: '2026-04-23T00:00:00Z',
    updated_at: '2026-04-23T00:00:00Z',
  }
}

const enumFixtures: Record<string, SystemEnumItem[]> = {
  product_status: [
    enumItem('product_status', '上架', '已上架'),
    enumItem('product_status', '下架不可售', '不可售'),
  ],
  product_type: [
    enumItem('product_type', '主品', '主产品'),
    enumItem('product_type', '配件', '配件'),
  ],
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({
    queryKey,
  }: {
    queryKey: unknown[]
  }) => {
    const [key, params] = queryKey
    if (key === 'categories-tree') {
      return {
        data: categoryTree,
        isLoading: false,
      }
    }

    if (key === 'skus-list') {
      list(params)
      return {
        data: {
          items: skuItems,
          total: 40,
          page: 1,
          page_size: 20,
        } as PaginatedResult<SkuListItem>,
        isLoading: false,
      }
    }

    if (key === 'system-enums' && typeof params === 'string') {
      return {
        data: enumFixtures[params] ?? [],
        isLoading: false,
      }
    }

    return {
      data: undefined,
      isLoading: false,
    }
  },
}))

beforeAll(() => {
  const originalGetComputedStyle = window.getComputedStyle.bind(window)
  Object.defineProperty(window, 'getComputedStyle', {
    writable: true,
    value: (element: Element) => originalGetComputedStyle(element),
  })

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})

beforeEach(() => {
  list.mockClear()
  navigate.mockClear()
  useUIStore.setState({
    tabs: [],
    activeTabKey: '',
    sidebarCollapsed: false,
  })
})

function renderSKUListPage(role: 'product_dept' | 'business_dept' | 'finance_dept' | 'admin') {
  useAuthStore.setState({
    user: { id: 1, username: 'tester', role },
    isAuthenticated: true,
  })

  return render(
    <ConfigProvider locale={zhCN}>
      <SKUListPage />
    </ConfigProvider>,
  )
}

describe('SKUListPage', () => {
  it('buildQueryParams 会带上产品状态和产品类型参数', () => {
    expect(
      buildQueryParams(
        {
          category_path: [1, 2, 3],
          supplier_name: '供应商甲',
          product_status: '下架不可售',
          product_type: '主品',
          keyword: 'Alpha',
        },
        20,
      ),
    ).toEqual({
      page: 1,
      page_size: 20,
      level1_category_id: 1,
      level2_category_id: 2,
      level3_category_id: 3,
      supplier_name: '供应商甲',
      product_status: '下架不可售',
      product_type: '主品',
      keyword: 'Alpha',
    })
  })

  it('加载后渲染筛选区、表格和分页', async () => {
    renderSKUListPage('product_dept')

    expect(await screen.findByText('超声刀 Alpha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /查\s*询/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /新\s*增/ })).toBeInTheDocument()
    expect(screen.getByText('SPU001')).toBeInTheDocument()
    expect(screen.getByText('不可售')).toBeInTheDocument()
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'SPAN' &&
          element.textContent?.replace(/\s+/g, ' ').trim() === '共 40 条',
      ),
    ).toBeInTheDocument()
    expect(list).toHaveBeenCalled()
  })

  it('点击查询时带供应商和关键词重新查询', async () => {
    const user = userEvent.setup()
    renderSKUListPage('product_dept')

    await screen.findByText('超声刀 Alpha')
    await user.clear(screen.getByLabelText('供应商'))
    await user.type(screen.getByLabelText('供应商'), '供应商甲')
    await user.clear(screen.getByLabelText('关键词'))
    await user.type(screen.getByLabelText('关键词'), 'Alpha')
    await user.click(screen.getByRole('button', { name: /查\s*询/ }))

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 20,
        level1_category_id: undefined,
        level2_category_id: undefined,
        level3_category_id: undefined,
        supplier_name: '供应商甲',
        product_status: undefined,
        product_type: undefined,
        keyword: 'Alpha',
      }),
    )
  })

  it('点击重置时恢复默认查询参数', async () => {
    const user = userEvent.setup()
    renderSKUListPage('product_dept')

    await screen.findByText('超声刀 Alpha')
    await user.clear(screen.getByLabelText('关键词'))
    await user.type(screen.getByLabelText('关键词'), 'Alpha')
    await user.click(screen.getByRole('button', { name: /查\s*询/ }))
    await user.click(screen.getByRole('button', { name: /重\s*置/ }))

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 20,
      }),
    )
  })

  it('点击分页后携带新页码重新查询', async () => {
    const user = userEvent.setup()
    renderSKUListPage('product_dept')

    await screen.findByText('超声刀 Alpha')
    await user.click(screen.getByTitle('2'))

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({
        page: 2,
        page_size: 20,
        level1_category_id: undefined,
        level2_category_id: undefined,
        level3_category_id: undefined,
        supplier_name: undefined,
        product_status: undefined,
        product_type: undefined,
        keyword: undefined,
      }),
    )
  })

  it('产品状态和产品类型筛选项消费枚举中心启用选项', async () => {
    const user = userEvent.setup()
    renderSKUListPage('product_dept')

    await screen.findByText('超声刀 Alpha')
    await user.click(screen.getByLabelText('产品状态'))
    expect(await screen.findByText('已上架')).toBeInTheDocument()
    expect(screen.getAllByText('不可售').length).toBeGreaterThan(0)

    await user.keyboard('{Escape}')
    await user.click(screen.getByLabelText('产品类型'))
    expect(await screen.findByText('主产品')).toBeInTheDocument()
  })

  it('只读角色不可见新增和编辑入口', async () => {
    renderSKUListPage('business_dept')

    expect(await screen.findByText('超声刀 Alpha')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /新\s*增/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看' })).toBeInTheDocument()
  })

  it('点击查看时跳转到详情页路径', async () => {
    const user = userEvent.setup()
    renderSKUListPage('product_dept')

    await screen.findByText('超声刀 Alpha')
    await user.click(screen.getByRole('button', { name: '查看' }))

    expect(navigate).toHaveBeenCalledWith('/products/skus/201')
    expect(useUIStore.getState().tabs.some((tab) => tab.key === '/products/skus/201')).toBe(true)
  })
})
