import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import dayjs from 'dayjs'
import { categoriesApi } from '../../api/categories'
import { certificatesApi } from '../../api/certificates'
import { enumsApi } from '../../api/enums'
import { filesApi } from '../../api/files'
import { spusApi } from '../../api/spus'
import CertificateFormPage, {
  persistCertificateWithOptionalFile,
  toCertificateMutationPayload,
} from '../../features/products/certificates/pages/CertificateFormPage'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import type { CategoryTreeNode, Certificate, SpuListItem } from '../../types/product'
import { uploadFile } from '../../utils/upload'

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

vi.mock('../../api/certificates', () => ({
  certificatesApi: {
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('../../api/enums', () => ({
  enumsApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../api/files', () => ({
  filesApi: {
    deleteObject: vi.fn(),
  },
}))

vi.mock('../../api/spus', () => ({
  spusApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../utils/upload', () => ({
  uploadFile: vi.fn(),
  formatFileSize: (size: number) => `${size} B`,
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

const certificateDetail: Certificate = {
  id: 1,
  name: 'CE证书',
  certificate_no: 'CERT-001',
  certificate_type: 'CE',
  issuing_authority: 'TUV',
  valid_from: '2026-01-01',
  valid_to: '2026-12-31',
  ownership_type: 'SPU归属',
  ownership_summary: 'SPU：超声平台',
  validity_status: '有效',
  spu_ids: [101],
  category_ids: [],
  spus: [{ id: 1, spu_id: 101, spu_code: 'SPU001', spu_name: '超声平台' }],
  categories: [],
  file_object_key: 'certificates/demo.pdf',
  file_url: 'https://example.com/demo.pdf',
  file_name: 'demo.pdf',
  remarks: '首版',
  created_at: '2026-04-20T09:00:00Z',
  updated_at: '2026-04-20T09:30:00Z',
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

  vi.mocked(categoriesApi.getTree).mockResolvedValue(categoryTree)
  vi.mocked(certificatesApi.getById).mockResolvedValue(certificateDetail)
  vi.mocked(enumsApi.list).mockResolvedValue([
    {
      id: 1,
      enum_group: 'certificate_type',
      enum_key: 'CE',
      enum_value: 'CE认证',
      description: null,
      sort_order: 1,
      is_enabled: true,
      is_protected: false,
      created_at: '2026-04-23T00:00:00Z',
      updated_at: '2026-04-23T00:00:00Z',
    },
  ])
  vi.mocked(spusApi.list).mockResolvedValue({
    items: [
      {
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
        created_at: '2026-04-20T09:00:00Z',
      },
    ] as SpuListItem[],
    total: 1,
    page: 1,
    page_size: 20,
  })

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
      mutations: { retry: false },
    },
  })
}

function renderPage(mode: 'create' | 'edit', certificateId: string | null) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ConfigProvider locale={zhCN}>
        <CertificateFormPage mode={mode} certificateId={certificateId} />
      </ConfigProvider>
    </QueryClientProvider>,
  )
}

describe('CertificateFormPage', () => {
  it('toCertificateMutationPayload 会按目标归属清空无关字段', () => {
    expect(
      toCertificateMutationPayload(
        {
          name: 'CE证书',
          certificate_no: 'CERT-001',
          certificate_type: 'CE',
          issuing_authority: 'TUV',
          validity_range: [dayjs('2026-01-01'), dayjs('2026-12-31')],
          ownership_type: '通用',
          spu_ids: [101],
          category_paths: [[1, 2, 3]],
          remarks: '首版',
        },
        {
          file_object_key: 'certificates/demo.pdf',
          file_url: 'https://example.com/demo.pdf',
          file_name: 'demo.pdf',
        },
      ),
    ).toEqual({
      name: 'CE证书',
      certificate_no: 'CERT-001',
      certificate_type: 'CE',
      issuing_authority: 'TUV',
      valid_from: '2026-01-01',
      valid_to: '2026-12-31',
      ownership_type: '通用',
      spu_ids: [],
      category_ids: [],
      file_object_key: 'certificates/demo.pdf',
      file_url: 'https://example.com/demo.pdf',
      file_name: 'demo.pdf',
      remarks: '首版',
    })
  })

  it('toCertificateMutationPayload 在未挂载归属字段缺失时也能安全转换', () => {
    expect(
      toCertificateMutationPayload(
        {
          name: 'CE证书',
          certificate_no: 'CERT-EMPTY',
          certificate_type: 'CE',
          issuing_authority: 'TUV',
          validity_range: [dayjs('2026-01-01'), dayjs('2026-12-31')],
          ownership_type: '通用',
          spu_ids: undefined as unknown as number[],
          category_paths: undefined as unknown as number[][],
          remarks: '',
        },
        {
          file_object_key: null,
          file_url: null,
          file_name: null,
        },
      ),
    ).toEqual({
      name: 'CE证书',
      certificate_no: 'CERT-EMPTY',
      certificate_type: 'CE',
      issuing_authority: 'TUV',
      valid_from: '2026-01-01',
      valid_to: '2026-12-31',
      ownership_type: '通用',
      spu_ids: [],
      category_ids: [],
      file_object_key: null,
      file_url: null,
      file_name: null,
      remarks: null,
    })
  })

  it('编辑路由参数非法时直接阻止表单渲染', async () => {
    renderPage('edit', 'foo')

    expect(await screen.findByText('证书标识无效')).toBeInTheDocument()
    expect(vi.mocked(certificatesApi.getById)).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /保\s*存/ })).not.toBeInTheDocument()
  })

  it('编辑详情加载失败时展示错误态', async () => {
    vi.mocked(certificatesApi.getById).mockRejectedValueOnce(new Error('load failed'))

    renderPage('edit', '1')

    expect(await screen.findByText('证书数据加载失败')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /保\s*存/ })).not.toBeInTheDocument()
  })

  it('新增态文件阶段失败时会回滚删除已创建证书', async () => {
    const file = new File(['certificate'], 'certificate.pdf', {
      type: 'application/pdf',
    })
    vi.mocked(certificatesApi.create).mockResolvedValue(certificateDetail)
    vi.mocked(uploadFile).mockRejectedValueOnce(new Error('upload failed'))
    vi.mocked(certificatesApi.remove).mockResolvedValue(undefined)

    await expect(
      persistCertificateWithOptionalFile({
        isEditMode: false,
        numericCertificateId: null,
        payload: toCertificateMutationPayload(
          {
            name: 'CE证书',
            certificate_no: 'CERT-001',
            certificate_type: 'CE',
            issuing_authority: 'TUV',
            validity_range: [dayjs('2026-01-01'), dayjs('2026-12-31')],
            ownership_type: '通用',
            spu_ids: [],
            category_paths: [],
            remarks: '首版',
          },
          {
            file_object_key: null,
            file_url: null,
            file_name: null,
          },
        ),
        selectedUploadFile: file,
        uploadedFileMeta: {
          file_object_key: null,
          file_url: null,
          file_name: null,
        },
        createCertificate: certificatesApi.create,
        updateCertificate: certificatesApi.update,
        removeCertificate: certificatesApi.remove,
        uploadSelectedFile: (selected) => uploadFile(selected, { folder: 'certificates' }),
        deleteUploadedObject: filesApi.deleteObject,
      }),
    ).rejects.toThrow('证书文件保存失败，已回滚本次新增：upload failed')

    expect(vi.mocked(certificatesApi.remove)).toHaveBeenCalledWith(certificateDetail.id)
  })

  it('新增态文件阶段失败且回滚失败时抛出半成功错误', async () => {
    const file = new File(['certificate'], 'certificate.pdf', {
      type: 'application/pdf',
    })
    vi.mocked(certificatesApi.create).mockResolvedValue(certificateDetail)
    vi.mocked(uploadFile).mockRejectedValueOnce(new Error('upload failed'))
    vi.mocked(certificatesApi.remove).mockRejectedValueOnce(new Error('rollback failed'))

    await expect(
      persistCertificateWithOptionalFile({
        isEditMode: false,
        numericCertificateId: null,
        payload: toCertificateMutationPayload(
          {
            name: 'CE证书',
            certificate_no: 'CERT-001',
            certificate_type: 'CE',
            issuing_authority: 'TUV',
            validity_range: [dayjs('2026-01-01'), dayjs('2026-12-31')],
            ownership_type: '通用',
            spu_ids: [],
            category_paths: [],
            remarks: '首版',
          },
          {
            file_object_key: null,
            file_url: null,
            file_name: null,
          },
        ),
        selectedUploadFile: file,
        uploadedFileMeta: {
          file_object_key: null,
          file_url: null,
          file_name: null,
        },
        createCertificate: certificatesApi.create,
        updateCertificate: certificatesApi.update,
        removeCertificate: certificatesApi.remove,
        uploadSelectedFile: (selected) => uploadFile(selected, { folder: 'certificates' }),
        deleteUploadedObject: filesApi.deleteObject,
      }),
    ).rejects.toThrow('自动回滚失败')
  })

  it('编辑态成功替换文件后会删除旧对象', async () => {
    const file = new File(['certificate'], 'certificate-new.pdf', {
      type: 'application/pdf',
    })
    vi.mocked(certificatesApi.update)
      .mockResolvedValueOnce(certificateDetail)
      .mockResolvedValueOnce({
        ...certificateDetail,
        file_object_key: 'certificates/new-file.pdf',
        file_url: 'https://example.com/new-file.pdf',
        file_name: 'certificate-new.pdf',
      })
    vi.mocked(uploadFile).mockResolvedValueOnce({
      fileKey: 'certificates/new-file.pdf',
      url: 'https://example.com/new-file.pdf',
      filename: 'certificate-new.pdf',
    })
    vi.mocked(filesApi.deleteObject).mockResolvedValue(undefined)

    const result = await persistCertificateWithOptionalFile({
      isEditMode: true,
      numericCertificateId: certificateDetail.id,
      payload: toCertificateMutationPayload(
        {
          name: 'CE证书',
          certificate_no: 'CERT-001',
          certificate_type: 'CE',
          issuing_authority: 'TUV',
          validity_range: [dayjs('2026-01-01'), dayjs('2026-12-31')],
          ownership_type: '通用',
          spu_ids: [],
          category_paths: [],
          remarks: '首版',
        },
        {
          file_object_key: certificateDetail.file_object_key ?? null,
          file_url: certificateDetail.file_url ?? null,
          file_name: certificateDetail.file_name ?? null,
        },
      ),
      selectedUploadFile: file,
      uploadedFileMeta: {
        file_object_key: certificateDetail.file_object_key ?? null,
        file_url: certificateDetail.file_url ?? null,
        file_name: certificateDetail.file_name ?? null,
      },
      createCertificate: certificatesApi.create,
      updateCertificate: certificatesApi.update,
      removeCertificate: certificatesApi.remove,
      uploadSelectedFile: (selected) => uploadFile(selected, { folder: 'certificates' }),
      deleteUploadedObject: filesApi.deleteObject,
    })

    expect(result.file_object_key).toBe('certificates/new-file.pdf')
    expect(vi.mocked(filesApi.deleteObject)).toHaveBeenCalledWith('certificates/demo.pdf')
  })

  it('编辑态删除旧文件失败时保留新文件成功结果', async () => {
    const file = new File(['certificate'], 'certificate-new.pdf', {
      type: 'application/pdf',
    })
    vi.mocked(certificatesApi.update)
      .mockResolvedValueOnce(certificateDetail)
      .mockResolvedValueOnce({
        ...certificateDetail,
        file_object_key: 'certificates/new-file.pdf',
        file_url: 'https://example.com/new-file.pdf',
        file_name: 'certificate-new.pdf',
      })
    vi.mocked(uploadFile).mockResolvedValueOnce({
      fileKey: 'certificates/new-file.pdf',
      url: 'https://example.com/new-file.pdf',
      filename: 'certificate-new.pdf',
    })
    vi.mocked(filesApi.deleteObject).mockRejectedValueOnce(new Error('cleanup failed'))
    const consoleErrorSpy = vi.spyOn(window.console, 'error').mockImplementation(() => {})

    const result = await persistCertificateWithOptionalFile({
      isEditMode: true,
      numericCertificateId: certificateDetail.id,
      payload: toCertificateMutationPayload(
        {
          name: 'CE证书',
          certificate_no: 'CERT-001',
          certificate_type: 'CE',
          issuing_authority: 'TUV',
          validity_range: [dayjs('2026-01-01'), dayjs('2026-12-31')],
          ownership_type: '通用',
          spu_ids: [],
          category_paths: [],
          remarks: '首版',
        },
        {
          file_object_key: certificateDetail.file_object_key ?? null,
          file_url: certificateDetail.file_url ?? null,
          file_name: certificateDetail.file_name ?? null,
        },
      ),
      selectedUploadFile: file,
      uploadedFileMeta: {
        file_object_key: certificateDetail.file_object_key ?? null,
        file_url: certificateDetail.file_url ?? null,
        file_name: certificateDetail.file_name ?? null,
      },
      createCertificate: certificatesApi.create,
      updateCertificate: certificatesApi.update,
      removeCertificate: certificatesApi.remove,
      uploadSelectedFile: (selected) => uploadFile(selected, { folder: 'certificates' }),
      deleteUploadedObject: filesApi.deleteObject,
    })

    expect(result.file_object_key).toBe('certificates/new-file.pdf')
    expect(vi.mocked(filesApi.deleteObject)).toHaveBeenCalledWith('certificates/demo.pdf')
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
