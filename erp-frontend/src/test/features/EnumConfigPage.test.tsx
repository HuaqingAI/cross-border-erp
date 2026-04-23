import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EnumConfigPage from '../../features/admin/enums/pages/EnumConfigPage'
import { enumsApi } from '../../api/enums'
import { useAuthStore } from '../../stores/authStore'
import type { SystemEnumGroupSummary, SystemEnumItem } from '../../types/product'

vi.mock('../../api/enums', () => ({
  enumsApi: {
    listGroups: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

const groups: SystemEnumGroupSummary[] = [
  {
    key: 'country_region',
    label: '国家/地区',
    description: '系统级国家/地区枚举，使用标准编码',
    total_count: 2,
    enabled_count: 2,
  },
  {
    key: 'currency',
    label: '币种',
    description: '价格相关币种',
    total_count: 1,
    enabled_count: 1,
  },
]

const countryRegionItems: SystemEnumItem[] = [
  {
    id: 1,
    enum_group: 'country_region',
    enum_key: 'GLOBAL',
    enum_value: '全球',
    description: '系统保留默认区域',
    sort_order: 0,
    is_enabled: true,
    is_protected: true,
    created_at: '2026-04-23T08:00:00Z',
    updated_at: '2026-04-23T08:00:00Z',
  },
  {
    id: 2,
    enum_group: 'country_region',
    enum_key: 'CN',
    enum_value: '中国',
    description: '系统默认国家/地区',
    sort_order: 10,
    is_enabled: true,
    is_protected: false,
    created_at: '2026-04-23T08:10:00Z',
    updated_at: '2026-04-23T08:10:00Z',
  },
]

const currencyItems: SystemEnumItem[] = [
  {
    id: 3,
    enum_group: 'currency',
    enum_key: 'USD',
    enum_value: '美元',
    description: '系统默认币种',
    sort_order: 10,
    is_enabled: true,
    is_protected: false,
    created_at: '2026-04-23T08:20:00Z',
    updated_at: '2026-04-23T08:20:00Z',
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
  vi.stubGlobal(
    'getComputedStyle',
    (((element: Element) => ({
      getPropertyValue: () => '',
      overflow: 'auto',
      overflowX: 'auto',
      overflowY: 'auto',
      display: element instanceof HTMLElement ? element.style.display || 'block' : 'block',
    })) as unknown) as typeof window.getComputedStyle,
  )
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(enumsApi.listGroups).mockResolvedValue(groups)
  vi.mocked(enumsApi.list).mockImplementation(async (params) => {
    if (params.group === 'currency') {
      return currencyItems
    }
    return countryRegionItems
  })
  vi.mocked(enumsApi.create).mockResolvedValue({
    id: 4,
    enum_group: 'country_region',
    enum_key: 'US',
    enum_value: '美国',
    description: '系统默认国家/地区',
    sort_order: 20,
    is_enabled: true,
    is_protected: false,
    created_at: '2026-04-23T08:30:00Z',
    updated_at: '2026-04-23T08:30:00Z',
  })
  vi.mocked(enumsApi.update).mockResolvedValue(countryRegionItems[1])
  vi.mocked(enumsApi.remove).mockResolvedValue(undefined)
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderEnumConfigPage(role: 'admin' | 'product_dept') {
  useAuthStore.setState({
    user: { id: 1, username: 'tester', role },
    isAuthenticated: true,
  })

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ConfigProvider locale={zhCN}>
        <AntdApp>
          <EnumConfigPage />
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>,
  )
}

describe('EnumConfigPage', () => {
  it('非管理员只能看到无权限提示', async () => {
    renderEnumConfigPage('product_dept')

    expect(screen.getByText('无权访问系统枚举配置')).toBeInTheDocument()
    expect(vi.mocked(enumsApi.listGroups)).not.toHaveBeenCalled()
  })

  it('管理员可以切换枚举组并查看对应列表', async () => {
    const user = userEvent.setup()
    renderEnumConfigPage('admin')

    expect(await screen.findByText('全球')).toBeInTheDocument()
    await user.click(screen.getByText('币种 (1/1)'))

    expect(await screen.findByText('美元')).toBeInTheDocument()
    await waitFor(() =>
      expect(vi.mocked(enumsApi.list)).toHaveBeenLastCalledWith({
        group: 'currency',
        include_disabled: true,
      }),
    )
  })

  it('管理员可以新增当前分组的枚举值', async () => {
    const user = userEvent.setup()
    renderEnumConfigPage('admin')

    await screen.findByText('全球')
    await user.click(screen.getByRole('button', { name: '新增枚举值' }))
    await user.type(screen.getByLabelText('编码'), 'US')
    await user.type(screen.getByLabelText('显示值'), '美国')
    await user.clear(screen.getByRole('spinbutton', { name: '排序' }))
    await user.type(screen.getByRole('spinbutton', { name: '排序' }), '20')
    await user.click(screen.getByRole('button', { name: /创\s*建/ }))

    await waitFor(() =>
      expect(vi.mocked(enumsApi.create)).toHaveBeenCalledWith({
        enum_group: 'country_region',
        enum_key: 'US',
        enum_value: '美国',
        description: null,
        sort_order: 20,
        is_enabled: true,
      }),
    )
  })

  it('GLOBAL 行展示为系统保留且不可删除停用', async () => {
    renderEnumConfigPage('admin')

    expect(await screen.findByText('系统保留')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '删除' })[0]).toBeDisabled()
    expect(screen.getAllByRole('switch')[0]).toBeDisabled()
  })
})
