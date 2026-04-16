import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CategoryPage from '../../features/products/categories/pages/CategoryPage'
import { useAuthStore } from '../../stores/authStore'
import type { CategoryTreeNode } from '../../types/product'

const categoryTree: CategoryTreeNode[] = [
  {
    id: 1,
    code: 'ROOT001',
    name: '一级分类',
    level: 1,
    parent_id: null,
    sort_order: 10,
    children: [
      {
        id: 2,
        code: 'CHILD001',
        name: '二级分类',
        level: 2,
        parent_id: 1,
        sort_order: 10,
        children: [],
      },
    ],
  },
]

const getTree = vi.fn()
const create = vi.fn()
const update = vi.fn()
const updateSort = vi.fn()
const remove = vi.fn()
const invalidateQueries = vi.fn().mockResolvedValue(undefined)

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: categoryTree,
    isLoading: false,
  }),
  useMutation: (options: {
    mutationFn: (variables: unknown) => Promise<unknown>
    onSuccess?: (data: unknown) => void | Promise<void>
    onError?: (error: unknown) => void
  }) => ({
    isPending: false,
    mutate: async (variables: unknown) => {
      try {
        const result = await options.mutationFn(variables)
        await options.onSuccess?.(result)
      } catch (error) {
        options.onError?.(error)
      }
    },
  }),
  useQueryClient: () => ({
    invalidateQueries,
  }),
}))

vi.mock('../../api/categories', () => ({
  categoriesApi: {
    getTree: (...args: unknown[]) => getTree(...args),
    create: (...args: unknown[]) => create(...args),
    update: (...args: unknown[]) => update(...args),
    updateSort: (...args: unknown[]) => updateSort(...args),
    remove: (...args: unknown[]) => remove(...args),
  },
}))

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd')
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
  }
})

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
  invalidateQueries.mockClear()
  getTree.mockResolvedValue(categoryTree)
  create.mockResolvedValue({
    id: 3,
    code: 'NEW001',
    name: '新分类',
    level: 1,
    parent_id: null,
    sort_order: 20,
  })
  update.mockResolvedValue({
    id: 1,
    code: 'ROOT001',
    name: '一级分类-更新',
    level: 1,
    parent_id: null,
    sort_order: 10,
  })
  updateSort.mockResolvedValue(undefined)
  remove.mockResolvedValue({ message: '删除成功' })
})

function renderCategoryPage(role: 'product_dept' | 'business_dept' | 'finance_dept' | 'admin') {
  useAuthStore.setState({
    user: { id: 1, username: 'tester', role },
    isAuthenticated: true,
  })

  return render(
    <ConfigProvider locale={zhCN}>
      <CategoryPage />
    </ConfigProvider>,
  )
}

describe('CategoryPage', () => {
  it('加载后渲染分类树和详情区域', async () => {
    renderCategoryPage('product_dept')

    expect(await screen.findByText('一级分类')).toBeInTheDocument()
    expect(screen.getByText('分类详情')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ROOT001')).toBeInTheDocument()
  })

  it('产品部用户可见新增一级分类操作', async () => {
    renderCategoryPage('product_dept')

    expect(await screen.findByRole('button', { name: '新增一级分类' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /保\s*存/ })).toBeInTheDocument()
  })

  it('只读角色不可见编辑操作', async () => {
    renderCategoryPage('business_dept')

    expect(await screen.findByText('一级分类')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '新增一级分类' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /保\s*存/ })).not.toBeInTheDocument()
    expect(screen.getByText('当前角色仅可浏览分类树，编辑功能已禁用')).toBeInTheDocument()
  })

  it('新增一级分类时调用创建接口', async () => {
    const user = userEvent.setup()
    renderCategoryPage('product_dept')

    await screen.findByText('一级分类')
    await user.click(screen.getByRole('button', { name: '新增一级分类' }))
    await user.clear(screen.getByLabelText('分类编码'))
    await user.type(screen.getByLabelText('分类编码'), 'NEW001')
    await user.clear(screen.getByLabelText('分类名称'))
    await user.type(screen.getByLabelText('分类名称'), '新分类')
    await user.click(screen.getByRole('button', { name: /保\s*存/ }))

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        code: 'NEW001',
        name: '新分类',
      }),
    )
  })
})
