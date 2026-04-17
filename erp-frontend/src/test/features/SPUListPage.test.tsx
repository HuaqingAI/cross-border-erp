import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SPUListPage from '../../features/products/spus/pages/SPUListPage'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import type { CategoryTreeNode, PaginatedResult, SpuListItem } from '../../types/product'

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

const spuItems: SpuListItem[] = [
  {
    id: 101,
    code: 'SPU001',
    name: '超声刀系统',
    level1_category_id: 1,
    level2_category_id: 2,
    level3_category_id: 3,
    supplier_name: '供应商甲',
    customer_warranty_months: 24,
    unit: '台',
    manufacturer_model: 'M-100',
    created_at: '2026-04-17T09:00:00Z',
    sku_count: null,
  },
]

const list = vi.fn()

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

    if (key === 'spus-list') {
      list(params)
      return {
        data: {
          items: spuItems,
          total: spuItems.length,
          page: 1,
          page_size: 20,
        } as PaginatedResult<SpuListItem>,
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

function renderSPUListPage(role: 'product_dept' | 'business_dept' | 'finance_dept' | 'admin') {
  useAuthStore.setState({
    user: { id: 1, username: 'tester', role },
    isAuthenticated: true,
  })

  return render(
    <ConfigProvider locale={zhCN}>
      <SPUListPage />
    </ConfigProvider>,
  )
}

describe('SPUListPage', () => {
  it('加载后渲染筛选区、表格和分页', async () => {
    renderSPUListPage('product_dept')

    expect(await screen.findByText('超声刀系统')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /查\s*询/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /新\s*增/ })).toBeInTheDocument()
    expect(screen.getByText('超声设备')).toBeInTheDocument()
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'SPAN' &&
          element.textContent?.replace(/\s+/g, ' ').trim() === '共 1 条',
      ),
    ).toBeInTheDocument()
    expect(list).toHaveBeenCalled()
  })

  it('点击查询时带关键词重新查询', async () => {
    const user = userEvent.setup()
    renderSPUListPage('product_dept')

    await screen.findByText('超声刀系统')
    await user.clear(screen.getByLabelText('关键词'))
    await user.type(screen.getByLabelText('关键词'), '超声')
    await user.click(screen.getByRole('button', { name: /查\s*询/ }))

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 20,
        level1_category_id: undefined,
        level2_category_id: undefined,
        level3_category_id: undefined,
        supplier_name: undefined,
        keyword: '超声',
      }),
    )
  })

  it('点击重置时恢复默认查询参数', async () => {
    const user = userEvent.setup()
    renderSPUListPage('product_dept')

    await screen.findByText('超声刀系统')
    await user.clear(screen.getByLabelText('关键词'))
    await user.type(screen.getByLabelText('关键词'), '超声')
    await user.click(screen.getByRole('button', { name: /查\s*询/ }))
    await user.click(screen.getByRole('button', { name: /重\s*置/ }))

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 20,
      }),
    )
  })

  it('只读角色不可见新增和编辑入口', async () => {
    renderSPUListPage('business_dept')

    expect(await screen.findByText('超声刀系统')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /新\s*增/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看' })).toBeInTheDocument()
  })

  it('点击查看时跳转到详情页路径', async () => {
    const user = userEvent.setup()
    renderSPUListPage('product_dept')

    await screen.findByText('超声刀系统')
    await user.click(screen.getByRole('button', { name: '查看' }))

    expect(navigate).toHaveBeenCalledWith('/products/spus/101')
    expect(useUIStore.getState().tabs.some((tab) => tab.key === '/products/spus/101')).toBe(true)
  })
})
