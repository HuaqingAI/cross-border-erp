import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { categoriesApi } from '../../api/categories'
import { certificatesApi } from '../../api/certificates'
import { documentsApi } from '../../api/documents'
import { enumsApi } from '../../api/enums'
import { faqsApi } from '../../api/faqs'
import { pricesApi } from '../../api/prices'
import { skusApi } from '../../api/skus'
import { spusApi } from '../../api/spus'
import SKUDetailPage from '../../features/products/skus/pages/SKUDetailPage'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import type {
  CategoryTreeNode,
  CertificateListItem,
  DocumentListItem,
  FaqListItem,
  PriceDetail,
  Sku,
  Spu,
  SystemEnumItem,
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

vi.mock('../../api/skus', () => ({
  skusApi: {
    getById: vi.fn(),
  },
}))

vi.mock('../../api/spus', () => ({
  spusApi: {
    getById: vi.fn(),
  },
}))

vi.mock('../../api/certificates', () => ({
  certificatesApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../api/documents', () => ({
  documentsApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../api/enums', () => ({
  enumsApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../api/faqs', () => ({
  faqsApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../api/prices', () => ({
  pricesApi: {
    getEffectiveBySku: vi.fn(),
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

const skuDetail: Sku = {
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
  restricted_countries: ['IR', 'KP'],
  customer_warranty_months: 24,
  core_params: '核心参数A',
  product_status: '上架',
  electrical_params: '220V',
  principle: '超声工作原理',
  usage: '用于检测',
  material: '金属',
  unit: '台',
  has_plug: true,
  is_special: false,
  special_notes: '特殊说明',
  package_type: '纸箱',
  package_quantity: 2,
  package_details: [
    {
      id: 1,
      net_weight_kg: '1.200',
      gross_weight_kg: '1.500',
      length_cm: '10.00',
      width_cm: '20.00',
      height_cm: '30.00',
      volume_cbm: '0.006000',
      sort_order: 0,
    },
  ],
  images: [
    {
      id: 1,
      object_key: 'skus/sku1.png',
      file_url: 'https://example.com/sku1.png',
      filename: 'sku1.png',
      content_type: 'image/png',
      sort_order: 0,
    },
  ],
  customs_hscode: '90181210',
  customs_supervision_condition: 'A',
  customs_declaration_elements: '申报要素',
  customs_refund_tax_rate: '13.00',
  customs_info_ready: true,
  created_at: '2026-04-23T08:00:00Z',
  updated_at: '2026-04-23T09:00:00Z',
}

const inheritedSpu: Spu = {
  id: 101,
  code: 'SPU001',
  name: '超声平台',
  level1_category_id: 1,
  level2_category_id: 2,
  level3_category_id: 3,
  supplier_name: '供应商甲',
  customer_warranty_months: 24,
  unit: '台',
  manufacturer_model: 'SPU-MODEL',
  purchase_price: '123.45',
  restricted_countries: ['IR', 'KP'],
  purchase_warranty_months: 18,
  supplier_warranty_notes: 'SPU质保说明',
  invoice_infos: [],
  created_at: '2026-04-22T08:00:00Z',
  updated_at: '2026-04-22T09:00:00Z',
}

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

const paginatedDocumentFixtures: DocumentListItem[] = Array.from({ length: 101 }, (_, index) => ({
  id: 700 + index,
  name: `分页资料-${index + 1}`,
  document_type: '产品手册',
  ownership_type: '指定SKU',
  ownership_summary: 'SKU：SKU001/超声刀 Alpha',
  sku_ids: [201],
  category_ids: [],
  applicable_countries: [],
  attachments: [],
  created_at: '2026-04-21T09:00:00Z',
}))

const documentFixtures: Record<'通用' | '指定SKU' | '按分类', DocumentListItem[]> = {
  通用: [
    {
      id: 401,
      name: '通用使用说明',
      document_type: '使用说明',
      ownership_type: '通用',
      ownership_summary: '全部产品通用',
      sku_ids: [],
      category_ids: [],
      applicable_countries: [],
      attachments: [],
      created_at: '2026-04-21T09:00:00Z',
    },
  ],
  指定SKU: [
    {
      id: 402,
      name: 'SKU 专属资料',
      document_type: '产品手册',
      ownership_type: '指定SKU',
      ownership_summary: 'SKU：SKU001/超声刀 Alpha',
      sku_ids: [201],
      category_ids: [],
      applicable_countries: [],
      attachments: [],
      created_at: '2026-04-21T09:00:00Z',
    },
    {
      id: 403,
      name: '其他SKU资料',
      document_type: '产品手册',
      ownership_type: '指定SKU',
      ownership_summary: 'SKU：SKU999/其他产品',
      sku_ids: [999],
      category_ids: [],
      applicable_countries: [],
      attachments: [],
      created_at: '2026-04-21T09:00:00Z',
    },
  ],
  按分类: [
    {
      id: 404,
      name: '超声分类资料',
      document_type: '技术参数',
      ownership_type: '按分类',
      ownership_summary: '分类：超声设备',
      sku_ids: [],
      category_ids: [3],
      applicable_countries: [],
      attachments: [],
      created_at: '2026-04-21T09:00:00Z',
    },
  ],
}

const allFaqs: FaqListItem[] = [
  {
    id: 501,
    spu_id: 101,
    question_type: '安装',
    question: '这台机器怎么安装？',
    answer: '按说明书安装',
    scope_summary: 'SPU：SPU001/超声平台',
    spu_code: 'SPU001',
    spu_name: '超声平台',
    created_at: '2026-04-21T09:00:00Z',
  },
  {
    id: 502,
    spu_id: null,
    question_type: '售后',
    question: '整机保修多久？',
    answer: '默认一年',
    scope_summary: '全局 FAQ',
    spu_code: null,
    spu_name: null,
    created_at: '2026-04-21T09:00:00Z',
  },
  {
    id: 503,
    spu_id: 999,
    question_type: '使用',
    question: '其他 SPU FAQ',
    answer: '不应出现',
    scope_summary: 'SPU：SPU999/其他产品',
    spu_code: 'SPU999',
    spu_name: '其他产品',
    created_at: '2026-04-21T09:00:00Z',
  },
]

const effectivePrice: PriceDetail = {
  id: 601,
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
  purchase_price: '123.45',
  supplier_name: '供应商甲',
  product_model: 'M-100',
  product_status: '上架',
  approval_status: '已生效',
  rejection_reason: null,
  submitted_at: null,
  submitted_by: null,
  approved_at: '2026-04-22T08:00:00Z',
  approved_by: 1,
  rejected_at: null,
  rejected_by: null,
  region_summary: '全球 CNY 199.00',
  updated_at: '2026-04-22T10:00:00Z',
  created_at: '2026-04-22T08:00:00Z',
  regions: [
    {
      id: 1,
      country_code: 'GLOBAL',
      country_name: '全球',
      currency: 'CNY',
      sale_price: '199.00',
      list_price: '259.00',
      remarks: '标准价',
      sort_order: 0,
    },
  ],
}

function enumItem(group: string, key: string, value: string): SystemEnumItem {
  return {
    id: Number(`${group.length}${key.length}${value.length}`),
    enum_group: group,
    enum_key: key,
    enum_value: value,
    description: null,
    sort_order: 10,
    is_enabled: true,
    is_protected: false,
    created_at: '2026-04-23T00:00:00Z',
    updated_at: '2026-04-23T00:00:00Z',
  }
}

const enumFixtures: Record<string, SystemEnumItem[]> = {
  product_type: [enumItem('product_type', '主品', '主产品')],
  product_status: [enumItem('product_status', '上架', '已上架')],
  unit: [enumItem('unit', '台', '台')],
  package_type: [enumItem('package_type', '纸箱', '纸箱包装')],
  country_region: [
    enumItem('country_region', 'IR', '伊朗'),
    enumItem('country_region', 'KP', '朝鲜'),
  ],
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

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverMock)

  const originalGetComputedStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    originalGetComputedStyle(element),
  )
})

beforeEach(() => {
  navigate.mockClear()
  drop.mockClear()
  vi.clearAllMocks()

  vi.mocked(categoriesApi.getTree).mockResolvedValue(categoryTree)
  vi.mocked(enumsApi.list).mockImplementation(async (params) => enumFixtures[params.group] ?? [])
  vi.mocked(skusApi.getById).mockResolvedValue(skuDetail)
  vi.mocked(spusApi.getById).mockResolvedValue(inheritedSpu)
  vi.mocked(certificatesApi.list).mockImplementation(async (params) => ({
    items: [
      ...certificateFixtures['通用'],
      ...certificateFixtures['SPU归属'].filter((item) =>
        item.spu_ids.includes(params.aggregate_spu_id ?? -1),
      ),
      ...certificateFixtures['按分类'].filter((item) =>
        item.category_ids.some((categoryId) =>
          (params.aggregate_category_ids ?? []).includes(categoryId),
        ),
      ),
    ],
    total: [
      ...certificateFixtures['通用'],
      ...certificateFixtures['SPU归属'].filter((item) =>
        item.spu_ids.includes(params.aggregate_spu_id ?? -1),
      ),
      ...certificateFixtures['按分类'].filter((item) =>
        item.category_ids.some((categoryId) =>
          (params.aggregate_category_ids ?? []).includes(categoryId),
        ),
      ),
    ].length,
    page: params.page,
    page_size: params.page_size,
  }))
  vi.mocked(documentsApi.list).mockImplementation(async (params) => ({
    items: [
      ...documentFixtures['通用'],
      ...documentFixtures['指定SKU'].filter((item) =>
        item.sku_ids.includes(params.aggregate_sku_id ?? -1),
      ),
      ...documentFixtures['按分类'].filter((item) =>
        item.category_ids.some((categoryId) =>
          (params.aggregate_category_ids ?? []).includes(categoryId),
        ),
      ),
    ].slice(((params.page ?? 1) - 1) * (params.page_size ?? 100), (params.page ?? 1) * (params.page_size ?? 100)),
    total: [
      ...documentFixtures['通用'],
      ...documentFixtures['指定SKU'].filter((item) =>
        item.sku_ids.includes(params.aggregate_sku_id ?? -1),
      ),
      ...documentFixtures['按分类'].filter((item) =>
        item.category_ids.some((categoryId) =>
          (params.aggregate_category_ids ?? []).includes(categoryId),
        ),
      ),
    ].length,
    page: params.page,
    page_size: params.page_size,
  }))
  vi.mocked(faqsApi.list).mockImplementation(async (params) => ({
    items:
      params.aggregate_spu_id == null
        ? allFaqs
        : allFaqs.filter((item) => item.spu_id == null || item.spu_id === params.aggregate_spu_id),
    total:
      params.aggregate_spu_id == null
        ? allFaqs.length
        : allFaqs.filter((item) => item.spu_id == null || item.spu_id === params.aggregate_spu_id)
            .length,
    page: params.page,
    page_size: params.page_size,
  }))
  vi.mocked(pricesApi.getEffectiveBySku).mockResolvedValue(effectivePrice)

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

function renderPage(skuId: string | null) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ConfigProvider locale={zhCN}>
        <SKUDetailPage skuId={skuId} />
      </ConfigProvider>
    </QueryClientProvider>,
  )
}

describe('SKUDetailPage', () => {
  it('会展示 SKU 摘要、基础信息和继承字段', async () => {
    renderPage('201')

    expect((await screen.findAllByText('超声刀 Alpha')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('SKU001').length).toBeGreaterThan(0)
    expect(screen.getAllByText('已上架').length).toBeGreaterThan(0)
    expect(screen.getByText('医疗设备 / 影像设备 / 超声设备')).toBeInTheDocument()
    expect(screen.getByText('主产品')).toBeInTheDocument()
    expect(screen.getByText('伊朗、朝鲜')).toBeInTheDocument()
    expect(screen.getByText('纸箱包装')).toBeInTheDocument()
    expect(await screen.findByText('123.45')).toBeInTheDocument()
    expect(screen.getByText('核心参数A')).toBeInTheDocument()
    expect(screen.getByText('sku1.png')).toBeInTheDocument()
  })

  it('会在各个 Tab 中展示聚合结果并支持跳转', async () => {
    const user = userEvent.setup()
    renderPage('201')

    expect((await screen.findAllByText('超声刀 Alpha')).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('tab', { name: '产品证书' }))
    expect(await screen.findByText('CE 通用证书')).toBeInTheDocument()
    expect(screen.getByText('SPU 专属证书')).toBeInTheDocument()
    expect(screen.getByText('超声分类证书')).toBeInTheDocument()
    expect(screen.queryByText('其他SPU证书')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'CE 通用证书' }))
    expect(navigate).toHaveBeenCalledWith('/products/certificates/301')

    await user.click(screen.getByRole('tab', { name: '产品资料' }))
    expect(await screen.findByText('通用使用说明')).toBeInTheDocument()
    expect(screen.getByText('SKU 专属资料')).toBeInTheDocument()
    expect(screen.getByText('超声分类资料')).toBeInTheDocument()
    expect(screen.queryByText('其他SKU资料')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '通用使用说明' }))
    expect(navigate).toHaveBeenCalledWith('/products/documents/401')

    await user.click(screen.getByRole('tab', { name: 'FAQ' }))
    expect(await screen.findByText('这台机器怎么安装？')).toBeInTheDocument()
    expect(screen.getByText('整机保修多久？')).toBeInTheDocument()
    expect(screen.queryByText('其他 SPU FAQ')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '这台机器怎么安装？' }))
    expect(navigate).toHaveBeenCalledWith('/products/faqs/501')

    await user.click(screen.getByRole('tab', { name: '销售价格' }))
    expect(await screen.findByText('全球')).toBeInTheDocument()
    expect(screen.getByText('199.00')).toBeInTheDocument()
  })

  it('商务部查看时不显示采购价', async () => {
    useAuthStore.setState({
      user: { id: 2, username: 'business', role: 'business_dept' },
      isAuthenticated: true,
    })

    renderPage('201')

    expect((await screen.findAllByText('超声刀 Alpha')).length).toBeGreaterThan(0)
    expect(screen.queryByText('采购价（CNY）')).not.toBeInTheDocument()
  })

  it('分类树加载失败时展示回退提示', async () => {
    vi.mocked(categoriesApi.getTree).mockRejectedValueOnce(new Error('load failed'))

    renderPage('201')

    expect(await screen.findByText('分类信息加载失败')).toBeInTheDocument()
    expect(
      screen.getByText('分类名称加载失败（分类ID：1 / 2 / 3）'),
    ).toBeInTheDocument()
  })

  it('没有已生效价格时显示空状态文案', async () => {
    vi.mocked(pricesApi.getEffectiveBySku).mockRejectedValueOnce({
      response: { status: 404 },
    })

    const user = userEvent.setup()
    renderPage('201')

    expect((await screen.findAllByText('超声刀 Alpha')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('tab', { name: '销售价格' }))

    expect((await screen.findAllByText('暂无已生效价格')).length).toBeGreaterThan(0)
  })

  it('销售价格接口失败时摘要区显示失败状态而不是空态', async () => {
    vi.mocked(pricesApi.getEffectiveBySku).mockRejectedValueOnce(new Error('load failed'))

    const user = userEvent.setup()
    renderPage('201')

    await user.click(await screen.findByRole('tab', { name: '销售价格' }))

    expect(await screen.findByText('销售价格加载失败')).toBeInTheDocument()
    expect(screen.getAllByText('加载失败').length).toBeGreaterThan(0)
  })

  it('聚合资料超过 100 条时会继续拉取后续分页', async () => {
    vi.mocked(documentsApi.list).mockImplementation(async (params) => {
      const start = ((params.page ?? 1) - 1) * (params.page_size ?? 100)
      const end = (params.page ?? 1) * (params.page_size ?? 100)
      return {
        items: paginatedDocumentFixtures.slice(start, end),
        total: paginatedDocumentFixtures.length,
        page: params.page,
        page_size: params.page_size,
      }
    })

    const user = userEvent.setup()
    renderPage('201')

    await user.click(await screen.findByRole('tab', { name: '产品资料' }))

    expect(await screen.findByText('分页资料-101')).toBeInTheDocument()
    expect(vi.mocked(documentsApi.list)).toHaveBeenCalledTimes(2)
  })

  it('聚合证书分页异常时展示错误提示而不是一直加载', async () => {
    vi.mocked(certificatesApi.list)
      .mockResolvedValueOnce({
        items: certificateFixtures['通用'],
        total: certificateFixtures['通用'].length + 1,
        page: 1,
        page_size: 100,
      })
      .mockResolvedValueOnce({
        items: [],
        total: certificateFixtures['通用'].length + 1,
        page: 2,
        page_size: 100,
      })

    const user = userEvent.setup()
    renderPage('201')

    await user.click(await screen.findByRole('tab', { name: '产品证书' }))

    expect(await screen.findByText('关联证书加载失败')).toBeInTheDocument()
    expect(screen.queryByText('暂无关联证书')).not.toBeInTheDocument()
  })
})
