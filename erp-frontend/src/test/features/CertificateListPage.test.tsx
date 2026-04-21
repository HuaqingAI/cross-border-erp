import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CertificateListPage, {
  buildQueryParams,
} from '../../features/products/certificates/pages/CertificateListPage'
import { certificatesApi } from '../../api/certificates'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import type { CertificateListItem, PaginatedResult } from '../../types/product'

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

vi.mock('../../api/certificates', () => ({
  certificatesApi: {
    list: vi.fn(),
    remove: vi.fn(),
  },
}))

const items: CertificateListItem[] = [
  {
    id: 1,
    name: 'CE证书',
    certificate_no: 'CERT-001',
    certificate_type: 'CE',
    issuing_authority: 'TUV',
    valid_from: '2026-01-01',
    valid_to: '2026-12-31',
    ownership_type: '通用',
    ownership_summary: '通用（全部产品）',
    validity_status: '即将过期',
    spu_ids: [],
    category_ids: [],
    created_at: '2026-04-20T09:00:00Z',
  },
]

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
  navigate.mockClear()
  vi.clearAllMocks()

  vi.mocked(certificatesApi.list).mockResolvedValue({
    items,
    total: 1,
    page: 1,
    page_size: 20,
  } as PaginatedResult<CertificateListItem>)

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
        <CertificateListPage />
      </ConfigProvider>
    </QueryClientProvider>,
  )
}

describe('CertificateListPage', () => {
  it('buildQueryParams 会带上证书筛选参数', () => {
    expect(
      buildQueryParams(
        {
          certificate_type: 'CE',
          ownership_type: 'SPU归属',
          validity_status: '即将过期',
          keyword: 'CERT',
        },
        20,
      ),
    ).toEqual({
      page: 1,
      page_size: 20,
      certificate_type: 'CE',
      ownership_type: 'SPU归属',
      validity_status: '即将过期',
      keyword: 'CERT',
    })
  })

  it('加载后渲染列表和状态标签', async () => {
    renderPage('product_dept')

    expect(await screen.findByText('CE证书')).toBeInTheDocument()
    expect(screen.getByText('CERT-001')).toBeInTheDocument()
    expect(screen.getByText('即将过期')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /新\s*增/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /查\s*看/ })).toBeInTheDocument()
  })

  it('点击查询时带关键词重新查询', async () => {
    const user = userEvent.setup()
    renderPage('product_dept')

    await screen.findByText('CE证书')
    await user.clear(screen.getByLabelText('关键词'))
    await user.type(screen.getByLabelText('关键词'), 'CERT')
    await user.click(screen.getByRole('button', { name: /查\s*询/ }))

    await waitFor(() =>
      expect(vi.mocked(certificatesApi.list)).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 20,
        certificate_type: undefined,
        ownership_type: undefined,
        validity_status: undefined,
        keyword: 'CERT',
      }),
    )
  })

  it('非产品角色不显示新增按钮但保留查看入口', async () => {
    renderPage('business_dept')

    await screen.findByText('CE证书')
    expect(screen.queryByRole('button', { name: /新\s*增/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /查\s*看/ })).toBeInTheDocument()
  })

  it('点击查看时跳转到详情页路径', async () => {
    const user = userEvent.setup()
    renderPage('business_dept')

    await screen.findByText('CE证书')
    await user.click(screen.getByRole('button', { name: /查\s*看/ }))

    expect(navigate).toHaveBeenCalledWith('/products/certificates/1')
  })
})
