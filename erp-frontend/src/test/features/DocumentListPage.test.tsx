import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentListPage, {
  buildQueryParams,
} from '../../features/products/documents/pages/DocumentListPage'
import { documentsApi } from '../../api/documents'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import type { DocumentListItem, PaginatedResult } from '../../types/product'

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

vi.mock('../../api/documents', () => ({
  documentsApi: {
    list: vi.fn(),
    remove: vi.fn(),
  },
}))

const items: DocumentListItem[] = [
  {
    id: 1,
    name: '产品手册A',
    document_type: '产品手册',
    ownership_type: '通用',
    ownership_summary: '通用（全部SKU）',
    sku_ids: [],
    category_ids: [],
    applicable_countries: ['US'],
    attachments: [],
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

  vi.mocked(documentsApi.list).mockResolvedValue({
    items,
    total: 1,
    page: 1,
    page_size: 20,
  } as PaginatedResult<DocumentListItem>)

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

function renderPage(role: 'product_dept' | 'business_dept' | 'finance_dept' | 'admin') {
  useAuthStore.setState({
    user: { id: 1, username: 'tester', role },
    isAuthenticated: true,
  })

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ConfigProvider locale={zhCN}>
        <DocumentListPage />
      </ConfigProvider>
    </QueryClientProvider>,
  )
}

describe('DocumentListPage', () => {
  it('buildQueryParams 会带上资料筛选参数', () => {
    expect(
      buildQueryParams(
        {
          document_type: '产品手册',
          ownership_type: '通用',
          keyword: '手册',
        },
        20,
      ),
    ).toEqual({
      page: 1,
      page_size: 20,
      document_type: '产品手册',
      ownership_type: '通用',
      keyword: '手册',
    })
  })

  it('加载后渲染资料列表', async () => {
    renderPage('product_dept')

    expect(await screen.findByText('产品手册A')).toBeInTheDocument()
    expect(screen.getByText('通用（全部SKU）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /新\s*增/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /查\s*看/ })).toBeInTheDocument()
  })

  it('点击查询时带关键词重新查询', async () => {
    const user = userEvent.setup()
    renderPage('product_dept')

    await screen.findByText('产品手册A')
    await user.clear(screen.getByLabelText('关键词'))
    await user.type(screen.getByLabelText('关键词'), '手册')
    await user.click(screen.getByRole('button', { name: /查\s*询/ }))

    await waitFor(() =>
      expect(vi.mocked(documentsApi.list)).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 20,
        document_type: undefined,
        ownership_type: undefined,
        keyword: '手册',
      }),
    )
  })

  it('非产品角色不显示新增按钮但保留查看入口', async () => {
    renderPage('business_dept')

    await screen.findByText('产品手册A')
    expect(screen.queryByRole('button', { name: /新\s*增/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /查\s*看/ })).toBeInTheDocument()
  })
})
