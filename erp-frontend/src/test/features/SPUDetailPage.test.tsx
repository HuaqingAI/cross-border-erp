import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { categoriesApi } from '../../api/categories'
import { certificatesApi } from '../../api/certificates'
import { faqsApi } from '../../api/faqs'
import { skusApi } from '../../api/skus'
import { spusApi } from '../../api/spus'
import SPUDetailPage from '../../features/products/spus/pages/SPUDetailPage'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import type {
  CategoryTreeNode,
  CertificateListItem,
  FaqListItem,
  PaginatedResult,
  SkuListItem,
  Spu,
} from '../../types/product'

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

vi.mock('../../api/categories', () => ({
  categoriesApi: {
    getTree: vi.fn(),
  },
}))

vi.mock('../../api/spus', () => ({
  spusApi: {
    getById: vi.fn(),
  },
}))

vi.mock('../../api/skus', () => ({
  skusApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../api/certificates', () => ({
  certificatesApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../api/faqs', () => ({
  faqsApi: {
    list: vi.fn(),
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

const spuDetailWithPrice: Spu = {
  id: 101,
  code: 'SPU001',
  name: '超声平台',
  level1_category_id: 1,
  level2_category_id: 2,
  level3_category_id: 3,
  supplier_name: '供应商甲',
  customer_warranty_months: 24,
  unit: '台',
  manufacturer_model: 'M-100',
  purchase_price: '123.45',
  purchase_warranty_months: 18,
  supplier_warranty_notes: '供应商整机质保 18 个月',
  restricted_countries: ['IR', 'KP'],
  invoice_infos: [
    {
      id: 1,
      invoice_name: '超声主机',
      invoice_unit: '台',
      invoice_model: 'US-100',
      company_subject: '深圳华擎科技有限公司',
      sort_order: 0,
    },
  ],
  created_at: '2026-04-22T08:00:00Z',
  updated_at: '2026-04-22T10:00:00Z',
}

const spuDetailWithoutPrice: Spu = {
  ...spuDetailWithPrice,
  purchase_price: undefined,
}

const skuItems: SkuListItem[] = [
  {
    id: 201,
    spu_id: 101,
    spu_code: 'SPU001',
    spu_name: '超声平台',
    code: 'SKU001',
    name_zh: '超声主机标准版',
    name_en: 'Ultrasound Standard',
    product_model: 'US-100',
    product_type: '主品',
    level1_category_id: 1,
    level2_category_id: 2,
    level3_category_id: 3,
    supplier_name: '供应商甲',
    product_status: '上架',
    customer_warranty_months: 24,
    created_at: '2026-04-22T08:10:00Z',
  },
  {
    id: 202,
    spu_id: 101,
    spu_code: 'SPU001',
    spu_name: '超声平台',
    code: 'SKU002',
    name_zh: '超声主机高配版',
    name_en: 'Ultrasound Pro',
    product_model: 'US-200',
    product_type: '主品',
    level1_category_id: 1,
    level2_category_id: 2,
    level3_category_id: 3,
    supplier_name: '供应商甲',
    product_status: '上架',
    customer_warranty_months: 24,
    created_at: '2026-04-22T08:20:00Z',
  },
]

const certificateFixtures: Record<'通用' | 'SPU归属' | '按分类', CertificateListItem[]> = {
  通用: [
    {
      id: 301,
      name: 'CE 通用证书',
      certificate_no: 'CERT-GLOBAL',
      certificate_type: 'CE',
      issuing_authority: 'TUV',
      valid_from: '2026-01-01',
      valid_to: '2026-12-31',
      ownership_type: '通用',
      ownership_summary: '全部产品通用',
      validity_status: '有效',
      spu_ids: [],
      category_ids: [],
      created_at: '2026-04-20T09:00:00Z',
    },
  ],
  SPU归属: [
    {
      id: 302,
      name: 'SPU 专属证书',
      certificate_no: 'CERT-SPU',
      certificate_type: 'FDA',
      issuing_authority: 'FDA',
      valid_from: '2026-01-01',
      valid_to: '2026-12-31',
      ownership_type: 'SPU归属',
      ownership_summary: 'SPU：SPU001/超声平台',
      validity_status: '有效',
      spu_ids: [101],
      category_ids: [],
      created_at: '2026-04-20T09:00:00Z',
    },
    {
      id: 303,
      name: '其他SPU证书',
      certificate_no: 'CERT-OTHER-SPU',
      certificate_type: 'CE',
      issuing_authority: 'TUV',
      valid_from: '2026-01-01',
      valid_to: '2026-12-31',
      ownership_type: 'SPU归属',
      ownership_summary: 'SPU：SPU999/其他产品',
      validity_status: '有效',
      spu_ids: [999],
      category_ids: [],
      created_at: '2026-04-20T09:00:00Z',
    },
  ],
  按分类: [
    {
      id: 304,
      name: '超声分类证书',
      certificate_no: 'CERT-CATEGORY',
      certificate_type: 'ISO13485',
      issuing_authority: 'SGS',
      valid_from: '2026-01-01',
      valid_to: '2026-12-31',
      ownership_type: '按分类',
      ownership_summary: '分类：超声设备',
      validity_status: '即将过期',
      spu_ids: [],
      category_ids: [3],
      created_at: '2026-04-20T09:00:00Z',
    },
    {
      id: 305,
      name: '其他分类证书',
      certificate_no: 'CERT-OTHER-CATEGORY',
      certificate_type: 'CE',
      issuing_authority: 'TUV',
      valid_from: '2026-01-01',
      valid_to: '2026-12-31',
      ownership_type: '按分类',
      ownership_summary: '分类：监护设备',
      validity_status: '有效',
      spu_ids: [],
      category_ids: [999],
      created_at: '2026-04-20T09:00:00Z',
    },
  ],
}

const spuFaqs: FaqListItem[] = [
  {
    id: 401,
    spu_id: 101,
    question_type: '安装',
    question: '这台机器怎么安装？',
    answer: '按说明书安装',
    scope_summary: 'SPU：SPU001/超声平台',
    spu_code: 'SPU001',
    spu_name: '超声平台',
    created_at: '2026-04-21T09:00:00Z',
  },
]

const globalFaqs: FaqListItem[] = [
  {
    id: 402,
    spu_id: null,
    question_type: '售后',
    question: '整机保修多久？',
    answer: '默认一年',
    scope_summary: '全局 FAQ',
    spu_code: null,
    spu_name: null,
    created_at: '2026-04-21T09:00:00Z',
  },
]

const otherSpuFaqs: FaqListItem[] = [
  {
    id: 403,
    spu_id: 999,
    question_type: '使用',
    question: '其他 SPU 的 FAQ',
    answer: '不应出现在当前 SPU 详情',
    scope_summary: 'SPU：SPU999/其他产品',
    spu_code: 'SPU999',
    spu_name: '其他产品',
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

  const originalGetComputedStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => originalGetComputedStyle(element))
})

beforeEach(() => {
  navigate.mockClear()
  drop.mockClear()
  vi.clearAllMocks()

  vi.mocked(categoriesApi.getTree).mockResolvedValue(categoryTree)
  vi.mocked(spusApi.getById).mockResolvedValue(spuDetailWithPrice)
  vi.mocked(skusApi.list).mockResolvedValue({
    items: skuItems,
    total: skuItems.length,
    page: 1,
    page_size: 100,
  } satisfies PaginatedResult<SkuListItem>)
  vi.mocked(certificatesApi.list).mockImplementation(async (params) => ({
    items: certificateFixtures[params.ownership_type as '通用' | 'SPU归属' | '按分类'] ?? [],
    total: (certificateFixtures[params.ownership_type as '通用' | 'SPU归属' | '按分类'] ?? []).length,
    page: params.page,
    page_size: params.page_size,
  }))
  vi.mocked(faqsApi.list).mockImplementation(async (params) => ({
    items: params.spu_id ? spuFaqs : [...globalFaqs, ...otherSpuFaqs],
    total: params.spu_id ? spuFaqs.length : globalFaqs.length + otherSpuFaqs.length,
    page: params.page,
    page_size: params.page_size,
  }))

  useAuthStore.setState({
    user: { id: 1, username: 'tester', role: 'product_dept' },
    isAuthenticated: true,
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
    },
  })
}

function renderPage(spuId: string | null) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ConfigProvider locale={zhCN}>
        <SPUDetailPage spuId={spuId} />
      </ConfigProvider>
    </QueryClientProvider>,
  )
}

describe('SPUDetailPage', () => {
  it('会展示 SPU 全量信息、聚合证书 FAQ，并支持点击 SKU 编码跳转详情', async () => {
    const user = userEvent.setup()

    renderPage('101')

    expect(await screen.findByText('超声平台')).toBeInTheDocument()
    expect(screen.getByText('医疗设备 / 影像设备 / 超声设备')).toBeInTheDocument()
    expect(screen.getByText('123.45')).toBeInTheDocument()
    expect(screen.getByText('供应商整机质保 18 个月')).toBeInTheDocument()
    expect(screen.getByText('超声主机')).toBeInTheDocument()
    expect(screen.getAllByText('上架').length).toBeGreaterThan(0)

    expect(await screen.findByText('CE 通用证书')).toBeInTheDocument()
    expect(screen.getByText('SPU 专属证书')).toBeInTheDocument()
    expect(screen.getByText('超声分类证书')).toBeInTheDocument()
    expect(screen.queryByText('其他SPU证书')).not.toBeInTheDocument()
    expect(screen.queryByText('其他分类证书')).not.toBeInTheDocument()

    expect(screen.getByText('这台机器怎么安装？')).toBeInTheDocument()
    expect(screen.getByText('整机保修多久？')).toBeInTheDocument()
    expect(screen.queryByText('其他 SPU 的 FAQ')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'SKU001' }))

    expect(navigate).toHaveBeenCalledWith('/products/skus/201')
    expect(useUIStore.getState().tabs).toEqual([
      {
        key: '/products/skus/201',
        label: 'SKU详情',
        closable: true,
      },
    ])
  })

  it('支持点击证书名称和 FAQ 问题跳转详情页签', async () => {
    const user = userEvent.setup()

    renderPage('101')

    await user.click(await screen.findByRole('button', { name: 'CE 通用证书' }))
    expect(navigate).toHaveBeenCalledWith('/products/certificates/301')

    await user.click(screen.getByRole('button', { name: '这台机器怎么安装？' }))
    expect(navigate).toHaveBeenCalledWith('/products/faqs/401')
  })

  it('商务部查看详情时不显示采购价和编辑按钮', async () => {
    useAuthStore.setState({
      user: { id: 2, username: 'business', role: 'business_dept' },
      isAuthenticated: true,
    })
    vi.mocked(spusApi.getById).mockResolvedValueOnce(spuDetailWithoutPrice)

    renderPage('101')

    expect(await screen.findByText('超声平台')).toBeInTheDocument()
    expect(screen.queryByText('采购价（CNY）')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument()
  })

  it('关联区查询失败时展示错误提示而不是空态', async () => {
    vi.mocked(certificatesApi.list).mockRejectedValueOnce(new Error('load failed'))

    renderPage('101')

    expect(await screen.findByText('关联证书加载失败')).toBeInTheDocument()
    expect(screen.queryByText('暂无关联证书')).not.toBeInTheDocument()
  })

  it('分类树加载失败时展示警告并回退到分类ID', async () => {
    vi.mocked(categoriesApi.getTree).mockRejectedValueOnce(new Error('load failed'))

    renderPage('101')

    expect(await screen.findByText('分类信息加载失败')).toBeInTheDocument()
    expect(
      screen.getByText('分类名称加载失败（分类ID：1 / 2 / 3）'),
    ).toBeInTheDocument()
  })
})
