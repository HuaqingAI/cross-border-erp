import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { categoriesApi } from '../../api/categories'
import { skusApi } from '../../api/skus'
import { spusApi } from '../../api/spus'
import SKUFormPage, {
  calculatePackageVolume,
  isSkuCodeTaken,
  toSkuCustomsPayload,
  toSkuFormValues,
  toSkuMutationPayload,
} from '../../features/products/skus/pages/SKUFormPage'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import type { CategoryTreeNode, Sku, Spu } from '../../types/product'

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
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateCustomsInfo: vi.fn(),
    addImage: vi.fn(),
    deleteImage: vi.fn(),
  },
}))

vi.mock('../../api/spus', () => ({
  spusApi: {
    list: vi.fn(),
    getById: vi.fn(),
  },
}))

vi.mock('../../utils/upload', () => ({
  uploadFile: vi.fn(),
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

const spuDetail: Spu = {
  id: 301,
  code: 'SPU301',
  name: '超声平台',
  level1_category_id: 1,
  level2_category_id: 2,
  level3_category_id: 3,
  supplier_name: '供应商甲',
  customer_warranty_months: 24,
  unit: '台',
  manufacturer_model: 'SPU-MODEL',
  created_at: '2026-04-18T09:00:00Z',
  updated_at: '2026-04-18T10:00:00Z',
  restricted_countries: ['US', 'DE'],
}

const skuDetail: Sku = {
  id: 201,
  spu_id: 301,
  spu_code: 'SPU301',
  spu_name: '超声平台',
  code: 'SKU201',
  name_zh: '超声刀 Alpha',
  name_en: 'Alpha Ultrasound',
  product_model: 'M-100',
  product_type: '主品',
  level1_category_id: 1,
  level2_category_id: 2,
  level3_category_id: 3,
  supplier_name: '供应商甲',
  restricted_countries: ['US', 'DE'],
  customer_warranty_months: 24,
  core_params: '核心参数',
  product_status: '上架',
  electrical_params: '220V',
  principle: '工作原理',
  usage: '临床用途',
  material: 'ABS',
  unit: '台',
  has_plug: true,
  is_special: false,
  special_notes: '特殊说明',
  package_type: '纸箱',
  package_quantity: 2,
  package_details: [
    {
      id: 1,
      net_weight_kg: '1.2',
      gross_weight_kg: '1.5',
      length_cm: '30',
      width_cm: '20',
      height_cm: '10',
      volume_cbm: '0.06',
      sort_order: 0,
    },
  ],
  images: [
    {
      id: 11,
      object_key: 'sku-images/test-1.png',
      file_url: 'https://example.com/test-1.png',
      filename: 'test-1.png',
      content_type: 'image/png',
      sort_order: 0,
    },
  ],
  customs_hscode: '9018',
  customs_supervision_condition: 'A',
  customs_declaration_elements: '申报要素',
  customs_refund_tax_rate: '13.0',
  customs_info_ready: true,
  created_at: '2026-04-18T09:00:00Z',
  updated_at: '2026-04-18T10:00:00Z',
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function setRole(role: 'product_dept' | 'business_dept' | 'finance_dept' | 'admin') {
  useAuthStore.setState({
    user: { id: 1, username: 'tester', role },
    isAuthenticated: true,
  })
}

function renderSKUFormPage({
  mode,
  skuId,
  currentPath,
  role,
}: {
  mode: 'create' | 'edit'
  skuId: string | null
  currentPath: string
  role: 'product_dept' | 'business_dept' | 'finance_dept' | 'admin'
}) {
  setRole(role)
  useUIStore.setState({
    tabs: [{ key: currentPath, label: '当前页', closable: true }],
    activeTabKey: currentPath,
    sidebarCollapsed: false,
  })

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ConfigProvider locale={zhCN}>
        <SKUFormPage mode={mode} skuId={skuId} />
      </ConfigProvider>
    </QueryClientProvider>,
  )
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
  vi.spyOn(window.console, 'error').mockImplementation(() => {})

  vi.mocked(categoriesApi.getTree).mockResolvedValue(categoryTree)
  vi.mocked(spusApi.list).mockResolvedValue({
    items: [spuDetail],
    total: 1,
    page: 1,
    page_size: 20,
  })
  vi.mocked(spusApi.getById).mockResolvedValue(spuDetail)
  vi.mocked(skusApi.getById).mockResolvedValue(skuDetail)
})

describe('SKUFormPage', () => {
  it('toSkuMutationPayload 会输出稳定的 SKU 写入结构', () => {
    expect(
      toSkuMutationPayload({
        spu_id: 301,
        code: ' SKU001 ',
        name_zh: ' 超声刀 ',
        name_en: ' Alpha ',
        product_model: ' M-100 ',
        product_type: '主品',
        core_params: ' 核心参数 ',
        product_status: '上架',
        electrical_params: ' 220V ',
        principle: ' 原理 ',
        usage: ' 用途 ',
        material: ' ABS ',
        unit: ' 台 ',
        has_plug: true,
        is_special: false,
        special_notes: ' 备注 ',
        package_type: ' 纸箱 ',
        package_quantity: 2,
        package_details: [
          {
            net_weight_kg: 1.2,
            gross_weight_kg: 1.5,
            length_cm: 30,
            width_cm: 20,
            height_cm: 10,
          },
        ],
        customs_hscode: null,
        customs_supervision_condition: null,
        customs_declaration_elements: null,
        customs_refund_tax_rate: null,
        customs_info_ready: false,
      }),
    ).toEqual({
      spu_id: 301,
      code: 'SKU001',
      name_zh: '超声刀',
      name_en: 'Alpha',
      product_model: 'M-100',
      product_type: '主品',
      core_params: '核心参数',
      product_status: '上架',
      electrical_params: '220V',
      principle: '原理',
      usage: '用途',
      material: 'ABS',
      unit: '台',
      has_plug: true,
      is_special: false,
      special_notes: '备注',
      package_type: '纸箱',
      package_quantity: 2,
      package_details: [
        {
          net_weight_kg: 1.2,
          gross_weight_kg: 1.5,
          length_cm: 30,
          width_cm: 20,
          height_cm: 10,
          volume_cbm: 0.006,
          sort_order: 0,
        },
      ],
    })
  })

  it('calculatePackageVolume 会按长宽高自动计算体积', () => {
    expect(
      calculatePackageVolume({
        length_cm: 1,
        width_cm: 1,
        height_cm: 1,
      }),
    ).toBe(0.000001)

    expect(
      calculatePackageVolume({
        length_cm: 30,
        width_cm: 20,
        height_cm: 10,
      }),
    ).toBe(0.006)
  })

  it('toSkuCustomsPayload 与 toSkuFormValues 会保留报关和包装字段', () => {
    expect(
      toSkuCustomsPayload({
        ...toSkuFormValues(skuDetail),
        customs_hscode: ' 9018 ',
        customs_supervision_condition: ' A ',
        customs_declaration_elements: ' 要素 ',
        customs_refund_tax_rate: 13,
        customs_info_ready: true,
      }),
    ).toEqual({
      customs_hscode: '9018',
      customs_supervision_condition: 'A',
      customs_declaration_elements: '要素',
      customs_refund_tax_rate: 13,
      customs_info_ready: true,
    })

    expect(toSkuFormValues(skuDetail).package_details).toHaveLength(1)
    expect(toSkuFormValues(skuDetail).customs_refund_tax_rate).toBe(13)
  })

  it('isSkuCodeTaken 会翻页查找精确匹配的 SKU 编码', async () => {
    vi.mocked(skusApi.list)
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, index) => ({
          id: index + 1,
          spu_id: 301,
          spu_code: 'SPU301',
          spu_name: '超声平台',
          code: `SKU-${index + 1}`,
          name_zh: '占位',
          name_en: 'placeholder',
          product_model: 'M',
          product_type: '主品',
          level1_category_id: 1,
          level2_category_id: 2,
          level3_category_id: 3,
          supplier_name: '供应商甲',
          product_status: '上架',
          customer_warranty_months: 24,
          created_at: '2026-04-18T09:00:00Z',
        })),
        total: 101,
        page: 1,
        page_size: 100,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 999,
            spu_id: 301,
            spu_code: 'SPU301',
            spu_name: '超声平台',
            code: 'SKU-TARGET',
            name_zh: '目标 SKU',
            name_en: 'target',
            product_model: 'M',
            product_type: '主品',
            level1_category_id: 1,
            level2_category_id: 2,
            level3_category_id: 3,
            supplier_name: '供应商甲',
            product_status: '上架',
            customer_warranty_months: 24,
            created_at: '2026-04-18T09:00:00Z',
          },
        ],
        total: 101,
        page: 2,
        page_size: 100,
      })

    await expect(isSkuCodeTaken('SKU-TARGET')).resolves.toBe(true)
    expect(vi.mocked(skusApi.list)).toHaveBeenNthCalledWith(1, {
      page: 1,
      page_size: 100,
      keyword: 'SKU-TARGET',
    })
    expect(vi.mocked(skusApi.list)).toHaveBeenNthCalledWith(2, {
      page: 2,
      page_size: 100,
      keyword: 'SKU-TARGET',
    })
  })

  it('新增态会渲染六个分区并支持取消返回列表', async () => {
    const user = userEvent.setup()
    renderSKUFormPage({
      mode: 'create',
      skuId: null,
      currentPath: '/products/skus/new',
      role: 'product_dept',
    })

    expect(await screen.findByText('基础信息')).toBeInTheDocument()
    expect(screen.getByText('产品属性')).toBeInTheDocument()
    expect(screen.getByText('特殊属性')).toBeInTheDocument()
    expect(screen.getByText('包装信息 + 包装明细')).toBeInTheDocument()
    expect(screen.getByText('报关信息')).toBeInTheDocument()
    expect(screen.getByText('产品图片')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /取\s*消/ }))

    expect(navigate).toHaveBeenCalledWith('/products/skus')
    expect(drop).toHaveBeenCalledWith('/products/skus/new')
    expect(useUIStore.getState().tabs.some((tab) => tab.key === '/products/skus/new')).toBe(false)
  })

  it('编辑路由参数非法时阻止表单渲染', async () => {
    renderSKUFormPage({
      mode: 'edit',
      skuId: 'foo',
      currentPath: '/products/skus/foo/edit',
      role: 'product_dept',
    })

    expect(await screen.findByText('SKU 标识无效')).toBeInTheDocument()
    expect(vi.mocked(skusApi.getById)).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /保\s*存/ })).not.toBeInTheDocument()
  })

  it('无权限新增时展示受限提示', async () => {
    renderSKUFormPage({
      mode: 'create',
      skuId: null,
      currentPath: '/products/skus/new',
      role: 'business_dept',
    })

    expect(await screen.findByText('当前角色无权访问此页面')).toBeInTheDocument()
    expect(screen.queryByLabelText('SKU编码')).not.toBeInTheDocument()
  })

  it('商务部编辑时仅报关字段可编辑', async () => {
    renderSKUFormPage({
      mode: 'edit',
      skuId: '201',
      currentPath: '/products/skus/201/edit',
      role: 'business_dept',
    })

    expect(await screen.findByDisplayValue('SKU201')).toBeDisabled()
    expect(screen.getByDisplayValue('超声刀 Alpha')).toBeDisabled()
    expect(screen.getByDisplayValue('9018')).not.toBeDisabled()
  })

  it('商务部保存报关失败时不会离开当前页面', async () => {
    const user = userEvent.setup()
    vi.mocked(skusApi.updateCustomsInfo).mockRejectedValueOnce(new Error('customs failed'))

    renderSKUFormPage({
      mode: 'edit',
      skuId: '201',
      currentPath: '/products/skus/201/edit',
      role: 'business_dept',
    })

    await screen.findByDisplayValue('9018')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))

    expect(navigate).not.toHaveBeenCalledWith('/products/skus')
    expect(drop).not.toHaveBeenCalledWith('/products/skus/201/edit')
    expect(useUIStore.getState().tabs.some((tab) => tab.key === '/products/skus/201/edit')).toBe(true)
  })

  it('SKU 编码即时校验接口失败时不应把原始 500 挂到字段上', async () => {
    const user = userEvent.setup()
    vi.mocked(skusApi.list).mockRejectedValueOnce(new Error('Request failed with status code 500'))

    renderSKUFormPage({
      mode: 'create',
      skuId: null,
      currentPath: '/products/skus/new',
      role: 'product_dept',
    })

    const codeInput = await screen.findByLabelText('SKU编码')
    await user.type(codeInput, 'TEST001')
    await user.tab()

    await waitFor(() =>
      expect(screen.queryByText('Request failed with status code 500')).not.toBeInTheDocument(),
    )
  })
})
