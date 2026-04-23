import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { categoriesApi } from '../../api/categories'
import { enumsApi } from '../../api/enums'
import { pricesApi } from '../../api/prices'
import { skusApi } from '../../api/skus'
import { spusApi } from '../../api/spus'
import PriceFormPage, {
  toPriceFormValues,
  toPricePayload,
} from '../../features/prices/pages/PriceFormPage'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import type { CategoryTreeNode, PriceDetail, Sku, SkuListItem, Spu } from '../../types/product'

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

vi.mock('../../api/enums', () => ({
  enumsApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../api/prices', () => ({
  pricesApi: {
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    submit: vi.fn(),
  },
}))

vi.mock('../../api/skus', () => ({
  skusApi: {
    list: vi.fn(),
    getById: vi.fn(),
  },
}))

vi.mock('../../api/spus', () => ({
  spusApi: {
    getById: vi.fn(),
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

const rejectedDetail: PriceDetail = {
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
  approved_at: '2026-04-20T09:00:00Z',
  approved_by: 1,
  rejected_at: '2026-04-22T09:00:00Z',
  rejected_by: 2,
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
      remarks: '初始价格',
      sort_order: 0,
    },
  ],
}

const draftDetail: PriceDetail = {
  ...rejectedDetail,
  approval_status: '草稿',
  rejection_reason: null,
  approved_at: null,
  approved_by: null,
  rejected_at: null,
  rejected_by: null,
}

const pendingDetail: PriceDetail = {
  ...rejectedDetail,
  approval_status: '待审批',
  rejection_reason: null,
}

const createSkuList: SkuListItem[] = [
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
    product_status: '上架',
    customer_warranty_months: 24,
    created_at: '2026-04-22T08:00:00Z',
  },
]

const createSkuDetail: Sku = {
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
  restricted_countries: [],
  customer_warranty_months: 24,
  core_params: '核心参数',
  product_status: '上架',
  principle: '工作原理',
  usage: '使用场景',
  unit: '台',
  has_plug: false,
  is_special: false,
  package_details: [],
  images: [],
  customs_info_ready: false,
  created_at: '2026-04-22T08:00:00Z',
  updated_at: '2026-04-22T08:30:00Z',
}

const createSpuDetail: Spu = {
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
  created_at: '2026-04-21T09:00:00Z',
  purchase_price: '128.50',
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
})

beforeEach(() => {
  navigate.mockClear()
  drop.mockClear()
  vi.clearAllMocks()

  useAuthStore.setState({
    user: { id: 1, username: 'finance', role: 'finance_dept' },
    isAuthenticated: true,
  })

  useUIStore.setState({
    tabs: [],
    activeTabKey: '',
    sidebarCollapsed: false,
  })

  vi.mocked(categoriesApi.getTree).mockResolvedValue(categoryTree)
  vi.mocked(enumsApi.list).mockImplementation(async (params) => {
    if (params.group === 'currency') {
      return [
        {
          id: 1,
          enum_group: 'currency',
          enum_key: 'CNY',
          enum_value: '人民币',
          sort_order: 0,
          is_enabled: true,
          is_protected: false,
          created_at: '2026-04-22T08:00:00Z',
          updated_at: '2026-04-22T08:00:00Z',
        },
        {
          id: 2,
          enum_group: 'currency',
          enum_key: 'USD',
          enum_value: '美元',
          sort_order: 10,
          is_enabled: true,
          is_protected: false,
          created_at: '2026-04-22T08:00:00Z',
          updated_at: '2026-04-22T08:00:00Z',
        },
      ]
    }

    return [
      {
        id: 3,
        enum_group: 'country_region',
        enum_key: 'GLOBAL',
        enum_value: '全球',
        sort_order: 0,
        is_enabled: true,
        is_protected: true,
        created_at: '2026-04-22T08:00:00Z',
        updated_at: '2026-04-22T08:00:00Z',
      },
      {
        id: 4,
        enum_group: 'country_region',
        enum_key: 'CN',
        enum_value: '中国',
        sort_order: 10,
        is_enabled: true,
        is_protected: false,
        created_at: '2026-04-22T08:00:00Z',
        updated_at: '2026-04-22T08:00:00Z',
      },
      {
        id: 5,
        enum_group: 'country_region',
        enum_key: 'US',
        enum_value: '美国',
        sort_order: 20,
        is_enabled: true,
        is_protected: false,
        created_at: '2026-04-22T08:00:00Z',
        updated_at: '2026-04-22T08:00:00Z',
      },
    ]
  })
  vi.mocked(pricesApi.getById).mockResolvedValue(rejectedDetail)
  vi.mocked(pricesApi.update).mockResolvedValue(rejectedDetail)
  vi.mocked(pricesApi.submit).mockResolvedValue(pendingDetail)
  vi.mocked(pricesApi.create).mockResolvedValue(rejectedDetail)
  vi.mocked(skusApi.list).mockResolvedValue({
    items: createSkuList,
    total: 1,
    page: 1,
    page_size: 20,
  })
  vi.mocked(skusApi.getById).mockResolvedValue(createSkuDetail)
  vi.mocked(spusApi.getById).mockResolvedValue(createSpuDetail)
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderPriceFormPage({
  mode,
  priceId,
  currentPath,
}: {
  mode: 'create' | 'edit'
  priceId: string | null
  currentPath: string
}) {
  useUIStore.setState({
    tabs: [{ key: currentPath, label: '当前页', closable: true }],
    activeTabKey: currentPath,
    sidebarCollapsed: false,
  })

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ConfigProvider locale={zhCN}>
        <AntdApp>
          <PriceFormPage mode={mode} priceId={priceId} />
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>,
  )
}

describe('PriceFormPage', () => {
  it('toPricePayload 与 toPriceFormValues 会输出稳定的价格表单结构', () => {
    expect(toPriceFormValues(rejectedDetail)).toEqual({
      sku_id: 201,
      regions: [
        {
          country_code: 'GLOBAL',
          country_name: '全球',
          currency: 'CNY',
          sale_price: 199,
          list_price: 259,
          remarks: '初始价格',
        },
      ],
    })

    expect(
      toPricePayload({
        sku_id: 201,
        regions: [
          {
            country_code: ' cn ',
            country_name: ' 中国 ',
            currency: ' usd ',
            sale_price: 29.9,
            list_price: 39.9,
            remarks: ' 备注 ',
          },
        ],
      }),
    ).toEqual({
      sku_id: 201,
      regions: [
        {
          country_code: 'CN',
          country_name: '中国',
          currency: 'USD',
          sale_price: 29.9,
          list_price: 39.9,
          remarks: '备注',
          sort_order: 0,
        },
      ],
    })
  })

  it('编辑态提交时会按最新枚举文案回写区域名称', async () => {
    const user = userEvent.setup()
    vi.mocked(enumsApi.list).mockImplementation(async (params) => {
      if (params.group === 'currency') {
        return [
          {
            id: 1,
            enum_group: 'currency',
            enum_key: 'CNY',
            enum_value: '人民币',
            sort_order: 0,
            is_enabled: true,
            is_protected: false,
            created_at: '2026-04-22T08:00:00Z',
            updated_at: '2026-04-22T08:00:00Z',
          },
        ]
      }

      return [
        {
          id: 3,
          enum_group: 'country_region',
          enum_key: 'GLOBAL',
          enum_value: '全球市场',
          sort_order: 0,
          is_enabled: true,
          is_protected: true,
          created_at: '2026-04-22T08:00:00Z',
          updated_at: '2026-04-22T08:00:00Z',
        },
      ]
    })

    renderPriceFormPage({
      mode: 'edit',
      priceId: '301',
      currentPath: '/prices/301/edit',
    })

    expect(await screen.findByText('当前记录已驳回')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /提交审批/ }))

    await waitFor(() =>
      expect(pricesApi.update).toHaveBeenCalledWith(301, {
        sku_id: 201,
        regions: [
          {
            country_code: 'GLOBAL',
            country_name: '全球市场',
            currency: 'CNY',
            sale_price: 199,
            list_price: 259,
            remarks: '初始价格',
            sort_order: 0,
          },
        ],
      }),
    )
  })

  it('新增态选择 SKU 后会自动带出只读 SKU 信息', async () => {
    const user = userEvent.setup()
    renderPriceFormPage({
      mode: 'create',
      priceId: null,
      currentPath: '/prices/new',
    })

    const selector = await screen.findByLabelText('选择SKU')
    await user.click(selector)
    await user.click(await screen.findByText('SKU001 | 超声刀 Alpha'))

    expect(await screen.findByText('供应商甲')).toBeInTheDocument()
    expect(screen.getByText('SPU001 | 超声平台')).toBeInTheDocument()
    expect(screen.getByText('医疗设备 / 影像设备 / 超声设备')).toBeInTheDocument()
    expect(screen.getByText('128.50')).toBeInTheDocument()
  })

  it('新增态保存草稿后返回列表', async () => {
    const user = userEvent.setup()
    vi.mocked(pricesApi.create).mockResolvedValueOnce(draftDetail)

    renderPriceFormPage({
      mode: 'create',
      priceId: null,
      currentPath: '/prices/new',
    })

    const selector = await screen.findByLabelText('选择SKU')
    await user.click(selector)
    await user.click(await screen.findByText('SKU001 | 超声刀 Alpha'))
    const numberInputs = screen.getAllByRole('spinbutton')
    await user.clear(numberInputs[0])
    await user.type(numberInputs[0], '199')
    await user.clear(numberInputs[1])
    await user.type(numberInputs[1], '259')
    await user.click(screen.getByRole('button', { name: '保存草稿' }))

    await waitFor(() => expect(pricesApi.create).toHaveBeenCalled())
    expect(pricesApi.submit).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/prices')
    expect(drop).toHaveBeenCalledWith('/prices/new')
  })

  it('已驳回记录可编辑后重新提交', async () => {
    const user = userEvent.setup()
    renderPriceFormPage({
      mode: 'edit',
      priceId: '301',
      currentPath: '/prices/301/edit',
    })

    expect(await screen.findByText('当前记录已驳回')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /提交审批/ }))

    await waitFor(() =>
      expect(pricesApi.update).toHaveBeenCalledWith(301, {
        sku_id: 201,
        regions: [
          {
            country_code: 'GLOBAL',
            country_name: '全球',
            currency: 'CNY',
            sale_price: 199,
            list_price: 259,
            remarks: '初始价格',
            sort_order: 0,
          },
        ],
      }),
    )
    expect(pricesApi.submit).toHaveBeenCalledWith(301)
    expect(navigate).toHaveBeenCalledWith('/prices')
    expect(drop).toHaveBeenCalledWith('/prices/301/edit')
  })

  it('新增态提交审批失败时会跳转到已保存记录的编辑页继续处理', async () => {
    const user = userEvent.setup()
    vi.mocked(pricesApi.create).mockResolvedValueOnce(draftDetail)
    vi.mocked(pricesApi.submit).mockRejectedValueOnce(new Error('submit failed'))
    vi.mocked(pricesApi.getById).mockResolvedValueOnce(draftDetail)

    renderPriceFormPage({
      mode: 'create',
      priceId: null,
      currentPath: '/prices/new',
    })

    const selector = await screen.findByLabelText('选择SKU')
    await user.click(selector)
    await user.click(await screen.findByText('SKU001 | 超声刀 Alpha'))

    const numberInputs = screen.getAllByRole('spinbutton')
    await user.clear(numberInputs[0])
    await user.type(numberInputs[0], '199')
    await user.clear(numberInputs[1])
    await user.type(numberInputs[1], '259')
    await user.click(screen.getByRole('button', { name: /提交审批/ }))

    await waitFor(() => expect(pricesApi.create).toHaveBeenCalled())
    expect(pricesApi.submit).toHaveBeenCalledWith(301)
    expect(navigate).toHaveBeenCalledWith('/prices/301/edit')
    expect(drop).toHaveBeenCalledWith('/prices/new')
    expect(useUIStore.getState().tabs.some((tab) => tab.key === '/prices/new')).toBe(false)
    expect(useUIStore.getState().tabs.some((tab) => tab.key === '/prices/301/edit')).toBe(true)
  })

  it('编辑态提交审批失败时保留当前页面以便继续处理', async () => {
    const user = userEvent.setup()
    vi.mocked(pricesApi.getById)
      .mockResolvedValueOnce(rejectedDetail)
      .mockResolvedValueOnce(draftDetail)
    vi.mocked(pricesApi.update).mockResolvedValueOnce(draftDetail)
    vi.mocked(pricesApi.submit).mockRejectedValueOnce(new Error('submit failed'))

    renderPriceFormPage({
      mode: 'edit',
      priceId: '301',
      currentPath: '/prices/301/edit',
    })

    expect(await screen.findByText('当前记录已驳回')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /提交审批/ }))

    await waitFor(() => expect(pricesApi.update).toHaveBeenCalled())
    expect(pricesApi.submit).toHaveBeenCalledWith(301)
    expect(navigate).not.toHaveBeenCalledWith('/prices')
    expect(drop).not.toHaveBeenCalledWith('/prices/301/edit')
    expect(useUIStore.getState().tabs.some((tab) => tab.key === '/prices/301/edit')).toBe(true)
  })

  it('待审批记录直接进入编辑路由时会显示不可编辑提示', async () => {
    vi.mocked(pricesApi.getById).mockResolvedValue(pendingDetail)

    renderPriceFormPage({
      mode: 'edit',
      priceId: '301',
      currentPath: '/prices/301/edit',
    })

    expect(await screen.findByText('待审批价格不可编辑')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /提交审批/ })).not.toBeInTheDocument()
  })
})
