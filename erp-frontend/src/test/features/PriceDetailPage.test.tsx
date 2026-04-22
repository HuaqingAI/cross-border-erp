import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PriceDetailPage from '../../features/prices/pages/PriceDetailPage'
import { pricesApi } from '../../api/prices'
import { buildDeletedRegionRows } from '../../features/prices/pages/PriceDetailPage'
import type { PriceDetail } from '../../types/product'

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

vi.mock('../../api/prices', () => ({
  pricesApi: {
    getById: vi.fn(),
    getEffectiveBySku: vi.fn(),
  },
}))

const pendingDraftDetail: PriceDetail = {
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
  approval_status: '待审批',
  rejection_reason: null,
  submitted_at: '2026-04-22T09:30:00Z',
  submitted_by: 2,
  approved_at: null,
  approved_by: null,
  rejected_at: null,
  rejected_by: null,
  region_summary: '全球 CNY 219.00',
  updated_at: '2026-04-22T10:00:00Z',
  created_at: '2026-04-22T08:00:00Z',
  regions: [
    {
      id: 1,
      country_code: 'GLOBAL',
      country_name: '全球',
      currency: 'CNY',
      sale_price: '219.00',
      list_price: '279.00',
      remarks: '标准价',
      sort_order: 0,
    },
    {
      id: 2,
      country_code: 'US',
      country_name: '美国',
      currency: 'USD',
      sale_price: '39.00',
      list_price: '59.00',
      remarks: '新区域',
      sort_order: 1,
    },
  ],
}

const effectiveDetail: PriceDetail = {
  ...pendingDraftDetail,
  approval_status: '已生效',
  submitted_at: null,
  submitted_by: null,
  approved_at: '2026-04-22T08:00:00Z',
  approved_by: 1,
  region_summary: '全球 CNY 199.00',
  regions: [
    {
      id: 11,
      country_code: 'GLOBAL',
      country_name: '全球',
      currency: 'CNY',
      sale_price: '199.00',
      list_price: '259.00',
      remarks: '旧生效价',
      sort_order: 0,
    },
    {
      id: 12,
      country_code: 'DE',
      country_name: '德国',
      currency: 'EUR',
      sale_price: '29.00',
      list_price: '49.00',
      remarks: '待删除区域',
      sort_order: 1,
    },
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
})

beforeEach(() => {
  navigate.mockClear()
  drop.mockClear()
  vi.clearAllMocks()
  vi.mocked(pricesApi.getById).mockResolvedValue(pendingDraftDetail)
  vi.mocked(pricesApi.getEffectiveBySku).mockResolvedValue(effectiveDetail)
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

describe('PriceDetailPage', () => {
  it('buildDeletedRegionRows 会返回当前生效但审批稿已删除的区域', () => {
    expect(buildDeletedRegionRows(pendingDraftDetail.regions, effectiveDetail.regions)).toEqual([
      effectiveDetail.regions[1],
    ])
  })

  it('会渲染当前审批稿和当前生效价格双视图', async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <ConfigProvider locale={zhCN}>
          <AntdApp>
            <PriceDetailPage priceId="301" />
          </AntdApp>
        </ConfigProvider>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('超声刀 Alpha')).toBeInTheDocument()
    expect(screen.getByText('SPU001 | 超声平台')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '当前生效价格' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '当前审批稿' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '待删除区域' })).toBeInTheDocument()
    expect(
      screen.getAllByRole('heading').map((element) => element.textContent),
    ).toEqual(['基础信息', '当前生效价格', '当前审批稿', '待删除区域'])
    expect(screen.getAllByText('全球').length).toBeGreaterThan(0)
    expect(screen.getByText('标准价')).toBeInTheDocument()
    expect(await screen.findAllByText('调高')).toHaveLength(2)
    expect(screen.getAllByText('新增')).toHaveLength(2)
    expect(screen.getByText('待审批')).toBeInTheDocument()
    expect(screen.getAllByText('德国').length).toBeGreaterThan(0)
  })

  it('没有已生效价格时显示空状态提示', async () => {
    vi.mocked(pricesApi.getEffectiveBySku).mockRejectedValueOnce({
      response: { status: 404 },
    })

    render(
      <QueryClientProvider client={createQueryClient()}>
        <ConfigProvider locale={zhCN}>
          <AntdApp>
            <PriceDetailPage priceId="301" />
          </AntdApp>
        </ConfigProvider>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('暂无已生效价格')).toBeInTheDocument()
  })

  it('已生效状态时当前审批稿显示为空', async () => {
    vi.mocked(pricesApi.getById).mockResolvedValueOnce(effectiveDetail)
    vi.mocked(pricesApi.getEffectiveBySku).mockResolvedValueOnce(effectiveDetail)

    render(
      <QueryClientProvider client={createQueryClient()}>
        <ConfigProvider locale={zhCN}>
          <AntdApp>
            <PriceDetailPage priceId="301" />
          </AntdApp>
        </ConfigProvider>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('当前审批稿')).toBeInTheDocument()
    expect(screen.getByText('暂无审批稿区域价格')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '当前生效价格' })).toBeInTheDocument()
    expect(await screen.findByText('旧生效价')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '待删除区域' })).not.toBeInTheDocument()
  })
})
