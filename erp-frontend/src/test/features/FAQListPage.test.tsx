import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FAQListPage, {
  buildQueryParams,
} from '../../features/products/faqs/pages/FAQListPage'
import { faqsApi } from '../../api/faqs'
import { spusApi } from '../../api/spus'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import type { FaqListItem, PaginatedResult, SpuListItem } from '../../types/product'

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

vi.mock('../../api/faqs', () => ({
  faqsApi: {
    list: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('../../api/spus', () => ({
  spusApi: {
    list: vi.fn(),
  },
}))

const items: FaqListItem[] = [
  {
    id: 1,
    spu_id: null,
    question_type: '售后',
    question: '支持蓝牙吗？',
    answer: '支持',
    scope_summary: '全局',
    spu_code: null,
    spu_name: null,
    attachment_object_key: null,
    attachment_file_url: null,
    attachment_file_name: null,
    created_at: '2026-04-21T09:00:00Z',
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

  vi.mocked(faqsApi.list).mockResolvedValue({
    items,
    total: 1,
    page: 1,
    page_size: 20,
  } as PaginatedResult<FaqListItem>)

  vi.mocked(spusApi.list).mockResolvedValue({
    items: [
      {
        id: 11,
        code: 'SPU001',
        name: '超声平台',
        level1_category_id: 1,
        level2_category_id: 2,
        level3_category_id: 3,
        supplier_name: '供应商甲',
        customer_warranty_months: 24,
        unit: '台',
        manufacturer_model: 'M-100',
        created_at: '2026-04-20T09:00:00Z',
      },
    ] as SpuListItem[],
    total: 1,
    page: 1,
    page_size: 20,
  })

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

function renderPage(
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
        <FAQListPage />
      </ConfigProvider>
    </QueryClientProvider>,
  )
}

describe('FAQListPage', () => {
  it('buildQueryParams 会带上 FAQ 筛选参数', () => {
    expect(
      buildQueryParams(
        {
          spu_id: 11,
          question_type: '售后',
          keyword: '蓝牙',
        },
        20,
      ),
    ).toEqual({
      page: 1,
      page_size: 20,
      spu_id: 11,
      question_type: '售后',
      keyword: '蓝牙',
    })
  })

  it('加载后渲染 FAQ 列表', async () => {
    renderPage('product_dept')

    expect(await screen.findByText('支持蓝牙吗？')).toBeInTheDocument()
    expect(screen.getByText('全局')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /新\s*增/ })).toBeInTheDocument()
  })

  it('点击查询时带关键词重新查询', async () => {
    const user = userEvent.setup()
    renderPage('product_dept')

    await screen.findByText('支持蓝牙吗？')
    await user.clear(screen.getByLabelText('关键词'))
    await user.type(screen.getByLabelText('关键词'), '蓝牙')
    await user.click(screen.getByRole('button', { name: /查\s*询/ }))

    await waitFor(() =>
      expect(vi.mocked(faqsApi.list)).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 20,
        spu_id: undefined,
        question_type: undefined,
        keyword: '蓝牙',
      }),
    )
  })

  it('非产品角色不显示新增按钮', async () => {
    renderPage('business_dept')

    await screen.findByText('支持蓝牙吗？')
    expect(screen.queryByRole('button', { name: /新\s*增/ })).not.toBeInTheDocument()
  })

  it('删除成功后会同步移除 FAQ 详情缓存', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(['faq-detail', 1], { id: 1, question: '支持蓝牙吗？' })
    vi.mocked(faqsApi.remove).mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderPage('product_dept', queryClient)

    await screen.findByText('支持蓝牙吗？')
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    await waitFor(() => expect(vi.mocked(faqsApi.remove)).toHaveBeenCalledWith(1))
    await waitFor(() =>
      expect(queryClient.getQueryData(['faq-detail', 1])).toBeUndefined(),
    )
  })
})
