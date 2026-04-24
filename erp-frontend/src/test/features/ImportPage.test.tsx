import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImportPage from '../../features/products/import/pages/ImportPage'
import { importsApi } from '../../api/imports'
import { useAuthStore } from '../../stores/authStore'
import type { ImportTaskProgress, ImportValidationResult } from '../../types/product'

vi.mock('../../api/imports', () => ({
  importsApi: {
    downloadTemplate: vi.fn(),
    validate: vi.fn(),
    confirm: vi.fn(),
    getTaskProgress: vi.fn(),
  },
}))

const categoryValidationResult: ImportValidationResult = {
  task_id: 101,
  task_type: 'categories',
  status: 'failed_validation',
  total_rows: 3,
  success_count: 1,
  failed_count: 2,
  progress_percent: 100,
  can_confirm: false,
  errors: [
    {
      row_number: 2,
      field: '分类编码',
      message: '分类编码已存在',
      row_key: 'CAT-001',
    },
    {
      row_number: 3,
      field: '父级分类编码',
      message: '父级分类编码不存在',
      row_key: 'CAT-002',
    },
  ],
}

const skuValidationResult: ImportValidationResult = {
  task_id: 202,
  task_type: 'skus',
  status: 'validated',
  total_rows: 2,
  success_count: 2,
  failed_count: 0,
  progress_percent: 100,
  can_confirm: true,
  errors: [],
}

const importingProgress: ImportTaskProgress = {
  id: 202,
  task_type: 'skus',
  status: 'importing',
  original_filename: 'skus.xlsx',
  total_rows: 2,
  valid_rows: 2,
  invalid_rows: 0,
  progress_percent: 40,
  validation_errors: [],
  result_summary: null,
  expires_at: null,
  confirmed_at: null,
}

const importFailedProgress: ImportTaskProgress = {
  id: 202,
  task_type: 'skus',
  status: 'import_failed',
  original_filename: 'skus.xlsx',
  total_rows: 2,
  valid_rows: 2,
  invalid_rows: 0,
  progress_percent: 40,
  validation_errors: [],
  result_summary: {
    error: '导入执行失败：数据库忙，请稍后重试',
  },
  expires_at: null,
  confirmed_at: null,
}

const importedProgressAfterError: ImportTaskProgress = {
  id: 202,
  task_type: 'skus',
  status: 'imported',
  original_filename: 'skus.xlsx',
  total_rows: 2,
  valid_rows: 2,
  invalid_rows: 0,
  progress_percent: 100,
  validation_errors: [],
  result_summary: {
    imported_count: 2,
  },
  expires_at: null,
  confirmed_at: '2026-04-24T08:00:00Z',
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
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(importsApi.downloadTemplate).mockResolvedValue({
    blob: new Blob(['demo']),
    filename: 'categories-import-template.xlsx',
  })
  vi.mocked(importsApi.validate).mockResolvedValue(categoryValidationResult)
  vi.mocked(importsApi.confirm).mockResolvedValue({
    task_id: 202,
    task_type: 'skus',
    status: 'imported',
    imported_count: 2,
    progress_percent: 100,
    confirmed_at: '2026-04-24T08:00:00Z',
  })
  vi.mocked(importsApi.getTaskProgress).mockResolvedValue(importingProgress)
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderImportPage(role: 'admin' | 'product_dept' | 'business_dept' = 'admin') {
  useAuthStore.setState({
    user: { id: 1, username: 'tester', role },
    isAuthenticated: true,
  })

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ConfigProvider locale={zhCN}>
        <AntdApp>
          <ImportPage />
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>,
  )
}

describe('ImportPage', () => {
  it('无权限用户看到明确提示', () => {
    renderImportPage('business_dept')

    expect(screen.getByText('无权访问数据导入')).toBeInTheDocument()
    expect(vi.mocked(importsApi.validate)).not.toHaveBeenCalled()
  })

  it('可以切换导入类型并下载当前模板', async () => {
    const user = userEvent.setup()
    renderImportPage('admin')

    await user.click(screen.getByRole('tab', { name: 'SKU' }))
    await user.click(screen.getByRole('button', { name: '下载模板' }))

    await waitFor(() => {
      expect(vi.mocked(importsApi.downloadTemplate)).toHaveBeenCalledWith('skus')
    })
  })

  it('上传后展示校验摘要和失败记录', async () => {
    const user = userEvent.setup()
    renderImportPage('admin')

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['demo'], 'categories.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(vi.mocked(importsApi.validate)).toHaveBeenCalledWith('categories', expect.any(File))
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('校验未通过')
    expect(screen.getByText('分类编码已存在')).toBeInTheDocument()
    expect(screen.getByText('父级分类编码不存在')).toBeInTheDocument()
    expect(screen.getByText('当前文件：categories.xlsx')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认导入' })).toBeDisabled()
  })

  it('校验通过后可以确认导入并显示进度', async () => {
    const user = userEvent.setup()
    vi.mocked(importsApi.validate).mockResolvedValueOnce(skuValidationResult)
    renderImportPage('admin')

    await user.click(screen.getByRole('tab', { name: 'SKU' }))

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['demo'], 'skus.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    await user.upload(fileInput, file)

    expect(await screen.findByText('任务 ID：202')).toBeInTheDocument()
    const confirmButton = screen.getByRole('button', { name: '确认导入' })
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)

    await waitFor(() => {
      expect(vi.mocked(importsApi.confirm)).toHaveBeenCalledWith('skus', { task_id: 202 })
    })

    await waitFor(() => {
      expect(vi.mocked(importsApi.getTaskProgress)).toHaveBeenCalledWith(202)
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('导入完成')
  })

  it('确认导入失败时会回读任务状态并展示失败原因', async () => {
    const user = userEvent.setup()
    vi.mocked(importsApi.validate).mockResolvedValueOnce(skuValidationResult)
    vi.mocked(importsApi.confirm).mockRejectedValueOnce(new Error('request failed'))
    vi.mocked(importsApi.getTaskProgress).mockResolvedValue(importFailedProgress)
    renderImportPage('admin')

    await user.click(screen.getByRole('tab', { name: 'SKU' }))

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['demo'], 'skus.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    await user.upload(fileInput, file)
    await screen.findByText('任务 ID：202')
    await user.click(screen.getByRole('button', { name: '确认导入' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('导入失败')
    expect(await screen.findByRole('alert')).toHaveTextContent('导入执行失败：数据库忙，请稍后重试')
    expect(screen.getByRole('button', { name: '确认导入' })).toBeDisabled()
  })

  it('确认请求异常但任务已成功导入时按成功状态收口', async () => {
    const user = userEvent.setup()
    vi.mocked(importsApi.validate).mockResolvedValueOnce(skuValidationResult)
    vi.mocked(importsApi.confirm).mockRejectedValueOnce(new Error('gateway timeout'))
    vi.mocked(importsApi.getTaskProgress).mockResolvedValue(importedProgressAfterError)
    renderImportPage('admin')

    await user.click(screen.getByRole('tab', { name: 'SKU' }))

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['demo'], 'skus.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    await user.upload(fileInput, file)
    await screen.findByText('任务 ID：202')
    await user.click(screen.getByRole('button', { name: '确认导入' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('导入完成')
    expect(screen.queryByText('导入失败')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认导入' })).toBeDisabled()
  })

  it('切换导入类型时保留各自状态', async () => {
    const user = userEvent.setup()
    vi.mocked(importsApi.validate)
      .mockResolvedValueOnce(categoryValidationResult)
      .mockResolvedValueOnce(skuValidationResult)
    renderImportPage('admin')

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const categoryFile = new File(['demo'], 'categories.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    await user.upload(fileInput, categoryFile)

    expect(await screen.findByRole('alert')).toHaveTextContent('校验未通过')
    expect(screen.getByText('当前文件：categories.xlsx')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'SKU' }))

    const skuFile = new File(['demo'], 'skus.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const skuFileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(skuFileInput, skuFile)

    expect(await screen.findByText('当前文件：skus.xlsx')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '确认导入' })).toBeEnabled()
    })

    await user.click(screen.getByRole('tab', { name: '分类' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('校验未通过')
    expect(screen.getByText('当前文件：categories.xlsx')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认导入' })).toBeDisabled()
  })
})
