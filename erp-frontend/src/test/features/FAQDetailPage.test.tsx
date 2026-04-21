import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import FAQDetailPage from '../../features/products/faqs/pages/FAQDetailPage'
import { faqsApi } from '../../api/faqs'
import type { Faq } from '../../types/product'

const navigate = vi.fn()
const drop = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

vi.mock('react-activation', () => ({
  useAliveController: () => ({
    drop,
  }),
}))

vi.mock('../../api/faqs', () => ({
  faqsApi: {
    getById: vi.fn(),
  },
}))

const faqDetail: Faq = {
  id: 1,
  spu_id: 11,
  question_type: '售后',
  question: '如何开机？',
  answer: '按电源键',
  scope_summary: 'SPU：SPU001/超声平台',
  spu_code: 'SPU001',
  spu_name: '超声平台',
  attachment_object_key: 'faqs/demo.pdf',
  attachment_file_url: 'http://localhost:9000/erp-files/faqs/demo.pdf',
  attachment_file_name: 'demo.pdf',
  created_at: '2026-04-21T09:00:00Z',
  updated_at: '2026-04-21T10:00:00Z',
}

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
})

beforeEach(() => {
  navigate.mockClear()
  drop.mockClear()
  vi.clearAllMocks()
  vi.mocked(faqsApi.getById).mockResolvedValue(faqDetail)
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

describe('FAQDetailPage', () => {
  it('会渲染 FAQ 详情与附件入口', async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <ConfigProvider locale={zhCN}>
          <FAQDetailPage faqId="1" />
        </ConfigProvider>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('如何开机？')).toBeInTheDocument()
    expect(screen.getByText('按电源键')).toBeInTheDocument()
    expect(screen.getByText('SPU001 | 超声平台')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看附件' })).toBeInTheDocument()
  })
})
