import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { categoriesApi } from '../../api/categories'
import { spusApi } from '../../api/spus'
import SPUFormPage from '../../features/products/spus/pages/SPUFormPage'
import { useUIStore } from '../../stores/uiStore'
import type { CategoryTreeNode, Spu } from '../../types/product'

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
    create: vi.fn(),
    update: vi.fn(),
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

const spuDetail: Spu = {
  id: 101,
  code: 'SPU001',
  name: '超声刀系统',
  level1_category_id: 1,
  level2_category_id: 2,
  level3_category_id: 3,
  supplier_name: '供应商甲',
  customer_warranty_months: 24,
  unit: '台',
  manufacturer_model: 'M-100',
  created_at: '2026-04-17T09:00:00Z',
  updated_at: '2026-04-17T10:00:00Z',
  restricted_countries: ['US'],
  purchase_price: '128.50',
  purchase_warranty_months: 12,
  supplier_warranty_notes: '标准质保',
  invoice_infos: [
    {
      id: 1,
      invoice_name: '超声设备',
      invoice_unit: '台',
      invoice_model: 'INV-1',
      company_subject: '华青医疗',
      sort_order: 0,
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
  vi.mocked(spusApi.getById).mockResolvedValue(spuDetail)

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

function renderSPUFormPage({
  mode,
  spuId,
  currentPath,
}: {
  mode: 'create' | 'edit'
  spuId: string | null
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
        <SPUFormPage mode={mode} spuId={spuId} />
      </ConfigProvider>
    </QueryClientProvider>,
  )
}

describe('SPUFormPage', () => {
  it('取消时会关闭当前页签并清理 KeepAlive 缓存', async () => {
    const user = userEvent.setup()
    renderSPUFormPage({
      mode: 'create',
      spuId: null,
      currentPath: '/products/spus/new',
    })

    await user.click(screen.getByRole('button', { name: /取\s*消/ }))

    expect(navigate).toHaveBeenCalledWith('/products/spus')
    expect(drop).toHaveBeenCalledWith('/products/spus/new')
    expect(useUIStore.getState().tabs.some((tab) => tab.key === '/products/spus/new')).toBe(false)
    expect(useUIStore.getState().tabs.some((tab) => tab.key === '/products/spus')).toBe(true)
  })

  it('编辑路由参数非法时直接阻止表单渲染', async () => {
    renderSPUFormPage({
      mode: 'edit',
      spuId: 'foo',
      currentPath: '/products/spus/foo/edit',
    })

    expect(await screen.findByText('SPU 标识无效')).toBeInTheDocument()
    expect(vi.mocked(spusApi.getById)).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /保\s*存/ })).not.toBeInTheDocument()
  })

  it('编辑详情加载失败时展示错误态而不是退化为空表单', async () => {
    vi.mocked(spusApi.getById).mockRejectedValueOnce(new Error('load failed'))

    renderSPUFormPage({
      mode: 'edit',
      spuId: '101',
      currentPath: '/products/spus/101/edit',
    })

    expect(await screen.findByText('SPU 数据加载失败')).toBeInTheDocument()
    expect(screen.queryByLabelText('SPU编码')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /保\s*存/ })).not.toBeInTheDocument()
  })

  it('开票信息至少保留一条，最后一行不可删除', async () => {
    const user = userEvent.setup()
    renderSPUFormPage({
      mode: 'create',
      spuId: null,
      currentPath: '/products/spus/new',
    })

    const addButton = screen.getByRole('button', { name: '添加开票信息' })
    const initialDeleteButton = screen.getByRole('button', { name: '删除' })
    expect(initialDeleteButton).toBeDisabled()

    await user.click(addButton)

    const deleteButtons = screen.getAllByRole('button', { name: '删除' })
    expect(deleteButtons).toHaveLength(2)
    expect(deleteButtons[0]).toBeEnabled()
    expect(deleteButtons[1]).toBeEnabled()

    await user.click(deleteButtons[0])

    await waitFor(() => expect(screen.getAllByRole('button', { name: '删除' })).toHaveLength(1))
    expect(screen.getByRole('button', { name: '删除' })).toBeDisabled()
  })
})
