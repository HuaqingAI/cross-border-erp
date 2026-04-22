import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PriceListPage, { buildQueryParams } from '../../features/prices/pages/PriceListPage'
import { categoriesApi } from '../../api/categories'
import { pricesApi } from '../../api/prices'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import type { CategoryTreeNode, PaginatedResult, PriceDetail, PriceListItem } from '../../types/product'

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd')
  return {
    ...actual,
    Popconfirm: ({
      children,
      onConfirm,
    }: {
      children: React.ReactNode
      onConfirm?: () => void
    }) => (
      <>
        {children}
        <button type="button" onClick={() => onConfirm?.()}>
          确认删除
        </button>
      </>
    ),
  }
})

vi.mock('../../api/categories', () => ({
  categoriesApi: {
    getTree: vi.fn(),
  },
}))

vi.mock('../../api/prices', () => ({
  pricesApi: {
    list: vi.fn(),
    submit: vi.fn(),
    remove: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
  },
}))

const categoryTree: CategoryTreeNode[] = [
  {
    id: 1,
    code: 'MED',
    name: '医疗设备',
    level: 1,
    parent_id: null,
    sort_order: 10,
    children: [],
  },
]

const priceItems: PriceListItem[] = [
  {
    id: 300,
    sku_id: 200,
    sku_code: 'SKU000',
    sku_name_zh: '超声刀 Draft',
    sku_name_en: 'Draft Ultrasound',
    spu_id: 101,
    spu_code: 'SPU001',
    spu_name: '超声平台',
    level1_category_id: 1,
    level1_category_code: 'MED',
    level1_category_name: '医疗设备',
    level2_category_id: 2,
    level2_category_code: 'IMG',
    level2_category_name: '影像设备',
    level3_category_id: 3,
    level3_category_code: 'ULT',
    level3_category_name: '超声设备',
    purchase_price: '120.00',
    supplier_name: '供应商草稿',
    product_model: 'M-050',
    product_status: '上架',
    approval_status: '草稿',
    rejection_reason: null,
    submitted_at: null,
    submitted_by: null,
    approved_at: null,
    approved_by: null,
    rejected_at: null,
    rejected_by: null,
    region_summary: '全球 CNY 88.00',
    updated_at: '2026-04-22T09:30:00Z',
    created_at: '2026-04-22T09:00:00Z',
  },
  {
    id: 301,
    sku_id: 201,
    sku_code: 'SKU001',
    sku_name_zh: '超声刀 Alpha',
    sku_name_en: 'Alpha Ultrasound',
    spu_id: 101,
    spu_code: 'SPU001',
    spu_name: '超声平台',
    level1_category_id: 1,
    level1_category_code: 'MED',
    level1_category_name: '医疗设备',
    level2_category_id: 2,
    level2_category_code: 'IMG',
    level2_category_name: '影像设备',
    level3_category_id: 3,
    level3_category_code: 'ULT',
    level3_category_name: '超声设备',
    purchase_price: '128.50',
    supplier_name: '供应商甲',
    product_model: 'M-100',
    product_status: '上架',
    approval_status: '已驳回',
    rejection_reason: '列表价过高',
    submitted_at: null,
    submitted_by: null,
    approved_at: null,
    approved_by: null,
    rejected_at: '2026-04-22T09:00:00Z',
    rejected_by: 1,
    region_summary: '全球 CNY 199.00',
    updated_at: '2026-04-22T10:00:00Z',
    created_at: '2026-04-22T08:00:00Z',
  },
  {
    id: 302,
    sku_id: 202,
    sku_code: 'SKU002',
    sku_name_zh: '超声刀 Beta',
    sku_name_en: 'Beta Ultrasound',
    spu_id: 101,
    spu_code: 'SPU001',
    spu_name: '超声平台',
    level1_category_id: 1,
    level1_category_code: 'MED',
    level1_category_name: '医疗设备',
    level2_category_id: 2,
    level2_category_code: 'IMG',
    level2_category_name: '影像设备',
    level3_category_id: 3,
    level3_category_code: 'ULT',
    level3_category_name: '超声设备',
    purchase_price: '130.00',
    supplier_name: '供应商乙',
    product_model: 'M-200',
    product_status: '上架',
    approval_status: '待审批',
    rejection_reason: null,
    submitted_at: '2026-04-22T11:00:00Z',
    submitted_by: 2,
    approved_at: null,
    approved_by: null,
    rejected_at: null,
    rejected_by: null,
    region_summary: '美国 USD 29.90',
    updated_at: '2026-04-22T11:00:00Z',
    created_at: '2026-04-22T10:30:00Z',
  },
]

beforeAll(() => {
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
  navigate.mockClear()
  vi.clearAllMocks()

  vi.mocked(categoriesApi.getTree).mockResolvedValue(categoryTree)
  vi.mocked(pricesApi.list).mockResolvedValue({
    items: priceItems,
    total: 32,
    page: 1,
    page_size: 20,
  } as PaginatedResult<PriceListItem>)
  vi.mocked(pricesApi.submit).mockResolvedValue({
    ...priceItems[0],
    approval_status: '待审批',
    regions: [],
  } as PriceDetail)
  vi.mocked(pricesApi.remove).mockResolvedValue(undefined)
  vi.mocked(pricesApi.approve).mockResolvedValue({
    ...priceItems[1],
    approval_status: '已生效',
    regions: [],
  } as PriceDetail)
  vi.mocked(pricesApi.reject).mockResolvedValue({
    ...priceItems[1],
    approval_status: '已驳回',
    rejection_reason: '价格超限',
    regions: [],
  } as PriceDetail)

  useUIStore.setState({
    tabs: [],
    activeTabKey: '',
    sidebarCollapsed: false,
  })
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderPriceListPage(
  role: 'product_dept' | 'business_dept' | 'finance_dept' | 'admin',
  queryClient = createQueryClient(),
) {
  useAuthStore.setState({
    user: { id: 1, username: 'tester', role },
    isAuthenticated: true,
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN}>
        <AntdApp>
          <PriceListPage />
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>,
  )
}

describe('PriceListPage', () => {
  it('buildQueryParams 会带上价格列表筛选参数', () => {
    expect(
      buildQueryParams(
        {
          level1_category_id: 1,
          approval_status: '待审批',
          supplier_name: '供应商甲',
          keyword: 'SKU001',
        },
        20,
      ),
    ).toEqual({
      page: 1,
      page_size: 20,
      level1_category_id: 1,
      approval_status: '待审批',
      supplier_name: '供应商甲',
      keyword: 'SKU001',
    })
  })

  it('加载后渲染筛选区、状态标签和操作按钮', async () => {
    renderPriceListPage('finance_dept')

    expect(await screen.findByText('超声刀 Alpha')).toBeInTheDocument()
    expect(screen.getByText('已驳回')).toBeInTheDocument()
    expect(screen.getByText('待审批')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /新\s*增/ })).toBeInTheDocument()
    expect(screen.getByText('128.50')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '查看' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: '提交审批' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '编辑并重提' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '删除' }).length).toBeGreaterThan(0)
  })

  it('草稿记录可直接在列表提交审批', async () => {
    const user = userEvent.setup()
    renderPriceListPage('finance_dept')

    await screen.findByText('超声刀 Draft')
    await user.click(screen.getAllByRole('button', { name: '提交审批' })[0])

    await waitFor(() => expect(vi.mocked(pricesApi.submit)).toHaveBeenCalledWith(300))
  })

  it('点击查询时带供应商和关键词重新查询', async () => {
    const user = userEvent.setup()
    renderPriceListPage('finance_dept')

    await screen.findByText('超声刀 Alpha')
    await user.clear(screen.getByLabelText('供应商'))
    await user.type(screen.getByLabelText('供应商'), '供应商甲')
    await user.clear(screen.getByLabelText('关键词'))
    await user.type(screen.getByLabelText('关键词'), 'SKU001')
    await user.click(screen.getByRole('button', { name: /查\s*询/ }))

    await waitFor(() =>
      expect(vi.mocked(pricesApi.list)).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 20,
        level1_category_id: undefined,
        approval_status: undefined,
        supplier_name: '供应商甲',
        keyword: 'SKU001',
      }),
    )
  })

  it('管理员可见审批通过和驳回入口', async () => {
    renderPriceListPage('admin')

    await screen.findByText('超声刀 Alpha')
    expect(screen.getByRole('button', { name: '审批通过' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '驳回' })).toBeInTheDocument()
  })

  it('删除成功后会同步移除价格详情缓存', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(['price-detail', 301], { id: 301, sku_code: 'SKU001' })
    const user = userEvent.setup()

    renderPriceListPage('finance_dept', queryClient)

    await screen.findByText('超声刀 Alpha')
    await user.click(screen.getAllByRole('button', { name: '确认删除' })[1])

    await waitFor(() => expect(vi.mocked(pricesApi.remove)).toHaveBeenCalledWith(301))
    await waitFor(() => expect(queryClient.getQueryData(['price-detail', 301])).toBeUndefined())
  })

  it('只读角色仅保留查看入口', async () => {
    renderPriceListPage('business_dept')

    await screen.findByText('超声刀 Alpha')
    expect(screen.queryByRole('button', { name: /新\s*增/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '编辑并重提' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '查看' }).length).toBeGreaterThan(0)
  })
})
