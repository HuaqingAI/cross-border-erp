import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Cascader,
  DatePicker,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Upload,
  message,
} from 'antd'
import type { DefaultOptionType } from 'antd/es/cascader'
import type { UploadFile, UploadProps } from 'antd/es/upload/interface'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useAliveController } from 'react-activation'
import { useNavigate } from 'react-router-dom'
import { categoriesApi } from '../../../../api/categories'
import { certificatesApi } from '../../../../api/certificates'
import { filesApi } from '../../../../api/files'
import { spusApi } from '../../../../api/spus'
import { FixedActionBar, FormSectionCard } from '../../../../components/common'
import FormGrid from '../../../../components/form/FormGrid'
import { usePermission } from '../../../../hooks/usePermission'
import { useUIStore } from '../../../../stores/uiStore'
import type {
  CategoryTreeNode,
  Certificate,
  CertificateMutationPayload,
  CertificateOwnershipType,
  SpuListItem,
} from '../../../../types/product'
import { formatFileSize, uploadFile } from '../../../../utils/upload'

interface CertificateFormPageProps {
  mode: 'create' | 'edit'
  certificateId: string | null
}

interface CertificateFormValues {
  name: string
  certificate_no: string
  certificate_type: string
  issuing_authority: string
  validity_range?: [dayjs.Dayjs, dayjs.Dayjs]
  ownership_type: CertificateOwnershipType
  spu_ids: number[]
  category_paths: number[][]
  remarks?: string
}

class PartialSaveError extends Error {
  certificate: Certificate

  constructor(messageText: string, certificate: Certificate) {
    super(messageText)
    this.name = 'PartialSaveError'
    this.certificate = certificate
  }
}

interface PersistCertificateOptions {
  isEditMode: boolean
  numericCertificateId: number | null
  payload: CertificateMutationPayload
  selectedUploadFile: File | null
  uploadedFileMeta: Pick<CertificateMutationPayload, 'file_object_key' | 'file_url' | 'file_name'>
  createCertificate: (data: CertificateMutationPayload) => Promise<Certificate>
  updateCertificate: (id: number, data: Partial<CertificateMutationPayload>) => Promise<Certificate>
  removeCertificate: (id: number) => Promise<void>
  uploadSelectedFile: (file: File) => Promise<{ fileKey: string; filename: string; url: string }>
  deleteUploadedObject: (objectKey: string) => Promise<void>
}

const CERTIFICATE_TYPE_OPTIONS = [
  'CE',
  'FDA',
  'ISO13485',
  'IEC检测报告',
  'DOC',
  '其他',
].map((value) => ({ label: value, value }))

const OWNERSHIP_OPTIONS: Array<{ label: CertificateOwnershipType; value: CertificateOwnershipType }> = [
  { label: '通用', value: '通用' },
  { label: 'SPU归属', value: 'SPU归属' },
  { label: '按分类', value: '按分类' },
]

const ALLOWED_CERTIFICATE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png']

const DEFAULT_FORM_VALUES: CertificateFormValues = {
  name: '',
  certificate_no: '',
  certificate_type: '',
  issuing_authority: '',
  validity_range: undefined,
  ownership_type: '通用',
  spu_ids: [],
  category_paths: [],
  remarks: '',
}

function getCurrentPath(mode: 'create' | 'edit', certificateId: string | null): string {
  if (mode === 'edit' && certificateId) {
    return `/products/certificates/${certificateId}/edit`
  }
  return '/products/certificates/new'
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'message' in error.response.data &&
    typeof error.response.data.message === 'string'
  ) {
    return error.response.data.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return '保存失败，请稍后重试'
}

function toCategoryOptions(nodes: CategoryTreeNode[]): DefaultOptionType[] {
  return nodes.map((node) => ({
    value: node.id,
    label: node.name,
    children: toCategoryOptions(node.children),
  }))
}

function findCategoryPath(
  nodes: CategoryTreeNode[],
  targetId: number,
  trail: number[] = [],
): number[] | null {
  for (const node of nodes) {
    const nextTrail = [...trail, node.id]
    if (node.id === targetId) {
      return nextTrail
    }
    const childResult = findCategoryPath(node.children, targetId, nextTrail)
    if (childResult) {
      return childResult
    }
  }
  return null
}

function toFormValues(certificate: Certificate, categoryTree: CategoryTreeNode[]): CertificateFormValues {
  return {
    name: certificate.name,
    certificate_no: certificate.certificate_no,
    certificate_type: certificate.certificate_type,
    issuing_authority: certificate.issuing_authority,
    validity_range: [dayjs(certificate.valid_from), dayjs(certificate.valid_to)],
    ownership_type: certificate.ownership_type,
    spu_ids: certificate.spu_ids ?? [],
    category_paths:
      certificate.category_ids
        ?.map((categoryId) => findCategoryPath(categoryTree, categoryId))
        .filter((value): value is number[] => Array.isArray(value)) ?? [],
    remarks: certificate.remarks ?? '',
  }
}

function buildSpuOptionLabel(spu: Pick<SpuListItem, 'code' | 'name'>): string {
  return `${spu.code} | ${spu.name}`
}

export function toCertificateMutationPayload(
  values: CertificateFormValues,
  fileMeta: Pick<CertificateMutationPayload, 'file_object_key' | 'file_url' | 'file_name'>,
): CertificateMutationPayload {
  const validRange = values.validity_range ?? [dayjs(), dayjs()]
  const ownershipType = values.ownership_type
  const categoryPaths = values.category_paths ?? []
  const spuIds = values.spu_ids ?? []
  const categoryIds = categoryPaths
    .map((path) => path[path.length - 1])
    .filter((value): value is number => typeof value === 'number')

  return {
    name: values.name.trim(),
    certificate_no: values.certificate_no.trim(),
    certificate_type: values.certificate_type.trim(),
    issuing_authority: values.issuing_authority.trim(),
    valid_from: validRange[0].format('YYYY-MM-DD'),
    valid_to: validRange[1].format('YYYY-MM-DD'),
    ownership_type: ownershipType,
    spu_ids: ownershipType === 'SPU归属' ? spuIds : [],
    category_ids: ownershipType === '按分类' ? categoryIds : [],
    file_object_key: fileMeta.file_object_key ?? null,
    file_url: fileMeta.file_url ?? null,
    file_name: fileMeta.file_name ?? null,
    remarks: values.remarks?.trim() || null,
  }
}

export async function persistCertificateWithOptionalFile(
  options: PersistCertificateOptions,
): Promise<Certificate> {
  const {
    isEditMode,
    numericCertificateId,
    payload,
    selectedUploadFile,
    uploadedFileMeta,
    createCertificate,
    updateCertificate,
    removeCertificate,
    uploadSelectedFile,
    deleteUploadedObject,
  } = options

  let savedCertificate: Certificate
  if (isEditMode && numericCertificateId !== null) {
    savedCertificate = await updateCertificate(numericCertificateId, payload)
  } else {
    savedCertificate = await createCertificate(payload)
  }

  if (!selectedUploadFile) {
    return savedCertificate
  }

  let uploaded:
    | {
        fileKey: string
        filename: string
        url: string
      }
    | null = null

  try {
    uploaded = await uploadSelectedFile(selectedUploadFile)
    savedCertificate = await updateCertificate(savedCertificate.id, {
      file_object_key: uploaded.fileKey,
      file_url: uploaded.url,
      file_name: uploaded.filename,
    })
  } catch (error) {
    if (uploaded) {
      await deleteUploadedObject(uploaded.fileKey).catch(() => undefined)
    }

    if (!isEditMode) {
      try {
        await removeCertificate(savedCertificate.id)
      } catch (rollbackError) {
        throw new PartialSaveError(
          `证书基础信息已保存，但证书文件保存失败，且自动回滚失败：${getErrorMessage(rollbackError)}`,
          savedCertificate,
        )
      }

      throw new Error(`证书文件保存失败，已回滚本次新增：${getErrorMessage(error)}`)
    }

    throw new PartialSaveError(
      `证书基础信息已保存，但证书文件保存失败：${getErrorMessage(error)}`,
      savedCertificate,
    )
  }

  const previousObjectKey = uploadedFileMeta.file_object_key
  if (previousObjectKey && previousObjectKey !== uploaded.fileKey) {
    await deleteUploadedObject(previousObjectKey).catch((cleanupError) => {
      window.console.error(cleanupError)
    })
  }

  return savedCertificate
}

export default function CertificateFormPage({
  mode,
  certificateId,
}: CertificateFormPageProps) {
  const [form] = Form.useForm<CertificateFormValues>()
  const permission = usePermission()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const closeTab = useUIStore((state) => state.closeTab)
  const openTab = useUIStore((state) => state.openTab)
  const { drop } = useAliveController()
  const [spuKeyword, setSpuKeyword] = useState('')
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null)
  const [uploadedFileMeta, setUploadedFileMeta] = useState<{
    file_object_key: string | null
    file_url: string | null
    file_name: string | null
  }>({
    file_object_key: null,
    file_url: null,
    file_name: null,
  })

  const currentPath = getCurrentPath(mode, certificateId)
  const isEditMode = mode === 'edit'
  const parsedCertificateId = certificateId ? Number(certificateId) : null
  const numericCertificateId =
    parsedCertificateId !== null && Number.isFinite(parsedCertificateId)
      ? parsedCertificateId
      : null
  const isInvalidEditTarget = isEditMode && numericCertificateId === null
  const canEdit = permission.canCreateProduct

  const categoriesQuery = useQuery({
    queryKey: ['categories-tree'],
    queryFn: categoriesApi.getTree,
  })

  const detailQuery = useQuery({
    queryKey: ['certificate-detail', numericCertificateId],
    queryFn: () => certificatesApi.getById(numericCertificateId as number),
    enabled: isEditMode && numericCertificateId !== null,
  })

  const spuOptionsQuery = useQuery({
    queryKey: ['certificate-spu-options', spuKeyword],
    queryFn: () =>
      spusApi.list({
        page: 1,
        page_size: 20,
        keyword: spuKeyword.trim() || undefined,
      }),
  })

  useEffect(() => {
    if (!detailQuery.data || categoriesQuery.isLoading) {
      return
    }

    form.setFieldsValue(toFormValues(detailQuery.data, categoriesQuery.data ?? []))
    setUploadedFileMeta({
      file_object_key: detailQuery.data.file_object_key ?? null,
      file_url: detailQuery.data.file_url ?? null,
      file_name: detailQuery.data.file_name ?? null,
    })
  }, [categoriesQuery.data, categoriesQuery.isLoading, detailQuery.data, form])

  const leaveCurrentTab = async () => {
    openTab({ key: '/products/certificates', label: '证书管理', closable: true })
    navigate('/products/certificates')
    drop(currentPath)
    closeTab(currentPath)
  }

  const categoryOptions = toCategoryOptions(categoriesQuery.data ?? [])
  const spuOptions = useMemo(() => {
    const options = new Map<number, string>()
    for (const item of spuOptionsQuery.data?.items ?? []) {
      options.set(item.id, buildSpuOptionLabel(item))
    }
    for (const item of detailQuery.data?.spus ?? []) {
      options.set(item.spu_id, `${item.spu_code} | ${item.spu_name}`)
    }
    return Array.from(options.entries()).map(([value, label]) => ({ value, label }))
  }, [detailQuery.data?.spus, spuOptionsQuery.data?.items])

  const ownershipType = Form.useWatch('ownership_type', form)

  const handleOwnershipTypeChange = (nextType: CertificateOwnershipType) => {
    form.setFieldValue('ownership_type', nextType)
    form.setFieldValue('spu_ids', [])
    form.setFieldValue('category_paths', [])
  }

  const uploadProps: UploadProps = {
    accept: '.pdf,.jpg,.jpeg,.png',
    maxCount: 1,
    beforeUpload: (file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_CERTIFICATE_EXTENSIONS.includes(extension)) {
        message.error('仅支持 PDF/JPG/PNG 格式')
        return Upload.LIST_IGNORE
      }
      setSelectedUploadFile(file)
      return false
    },
    onRemove: () => {
      setSelectedUploadFile(null)
      return true
    },
    fileList: selectedUploadFile
      ? [
          {
            uid: 'selected-certificate-file',
            name: selectedUploadFile.name,
            size: selectedUploadFile.size,
            status: 'done',
          } as UploadFile,
        ]
      : [],
  }

  const saveMutation = useMutation({
    mutationFn: (values: CertificateFormValues) => {
      const payload = toCertificateMutationPayload(values, uploadedFileMeta)
      return persistCertificateWithOptionalFile({
        isEditMode,
        numericCertificateId,
        payload,
        selectedUploadFile,
        uploadedFileMeta,
        createCertificate: certificatesApi.create,
        updateCertificate: certificatesApi.update,
        removeCertificate: certificatesApi.remove,
        uploadSelectedFile: (file) => uploadFile(file, { folder: 'certificates' }),
        deleteUploadedObject: filesApi.deleteObject,
      })
    },
    onSuccess: async (certificate) => {
      message.success('保存成功')
      await queryClient.invalidateQueries({ queryKey: ['certificates-list'] })
      queryClient.setQueryData(['certificate-detail', certificate.id], certificate)
      await leaveCurrentTab()
    },
    onError: (error) => {
      if (error instanceof PartialSaveError) {
        void queryClient.invalidateQueries({ queryKey: ['certificates-list'] })
        queryClient.setQueryData(['certificate-detail', error.certificate.id], error.certificate)

        if (!isEditMode) {
          const recoveryPath = `/products/certificates/${error.certificate.id}/edit`
          openTab({ key: recoveryPath, label: '编辑证书', closable: true })
          navigate(recoveryPath)
          drop(currentPath)
          closeTab(currentPath)
        }

        message.error(error.message)
        return
      }

      message.error(getErrorMessage(error))
    },
  })

  const handleSubmit = async () => {
    let values: CertificateFormValues
    try {
      values = await form.validateFields()
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'errorFields' in error &&
        Array.isArray((error as { errorFields?: Array<{ name: Array<string | number> }> }).errorFields)
      ) {
        const firstField = (error as { errorFields: Array<{ name: Array<string | number> }> }).errorFields[0]
        if (firstField?.name) {
          form.scrollToField(firstField.name, { behavior: 'smooth', block: 'center' })
        }
        return
      }
      message.error(getErrorMessage(error))
      return
    }

    try {
      await saveMutation.mutateAsync(values)
    } catch (error) {
      // mutation 的业务提示与恢复动作由 useMutation.onError 统一处理，
      // 这里仅保底打印，避免再次被外层静默吞掉
      window.console.error(error)
    }
  }

  if (isInvalidEditTarget) {
    return (
      <div style={{ padding: 16 }}>
        <div
          style={{
            minHeight: 320,
            background: '#fff',
            borderRadius: 4,
            border: '1px solid #f0f0f0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600 }}>证书标识无效</div>
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>当前编辑地址缺少有效的证书 ID，请返回列表后重新进入。</div>
          <Button type="primary" onClick={() => void leaveCurrentTab()}>
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  if (isEditMode && detailQuery.isError) {
    return (
      <div style={{ padding: 16 }}>
        <div
          style={{
            minHeight: 320,
            background: '#fff',
            borderRadius: 4,
            border: '1px solid #f0f0f0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600 }}>证书数据加载失败</div>
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>请返回证书列表后重试，或稍后刷新页面。</div>
          <Button type="primary" onClick={() => void leaveCurrentTab()}>
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div style={{ padding: 16 }}>
        <div
          style={{
            minHeight: 320,
            background: '#fff',
            borderRadius: 4,
            border: '1px solid #f0f0f0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600 }}>无权编辑证书</div>
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>当前角色仅可查看证书列表，不能进入新增或编辑页。</div>
          <Button type="primary" onClick={() => void leaveCurrentTab()}>
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 16px 88px 16px' }}>
      <Form
        form={form}
        layout="vertical"
        initialValues={DEFAULT_FORM_VALUES}
        onFinish={() => void handleSubmit()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormSectionCard title="基础资料">
            <FormGrid>
              <Form.Item
                label="证书名称"
                name="name"
                rules={[{ required: true, message: '请输入证书名称' }]}
              >
                <Input placeholder="请输入证书名称" maxLength={100} />
              </Form.Item>
              <Form.Item
                label="证书编号"
                name="certificate_no"
                rules={[{ required: true, message: '请输入证书编号' }]}
              >
                <Input placeholder="请输入证书编号" maxLength={100} />
              </Form.Item>
              <Form.Item
                label="证书类型"
                name="certificate_type"
                rules={[{ required: true, message: '请选择证书类型' }]}
              >
                <Select
                  showSearch
                  placeholder="请选择证书类型"
                  options={CERTIFICATE_TYPE_OPTIONS}
                  optionFilterProp="label"
                />
              </Form.Item>
              <Form.Item
                label="发证机构"
                name="issuing_authority"
                rules={[{ required: true, message: '请输入发证机构' }]}
              >
                <Input placeholder="请输入发证机构" maxLength={100} />
              </Form.Item>
              <Form.Item
                label="有效期"
                name="validity_range"
                rules={[{ required: true, message: '请选择有效期' }]}
              >
                <DatePicker.RangePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="证书说明" name="remarks">
                <Input.TextArea placeholder="请输入证书说明" rows={3} maxLength={1000} />
              </Form.Item>
            </FormGrid>
          </FormSectionCard>

          <FormSectionCard title="归属信息">
            <Form.Item
              label="归属类型"
              name="ownership_type"
              rules={[{ required: true, message: '请选择归属类型' }]}
            >
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                options={OWNERSHIP_OPTIONS}
                onChange={(event) => handleOwnershipTypeChange(event.target.value as CertificateOwnershipType)}
              />
            </Form.Item>

            {ownershipType === 'SPU归属' ? (
              <Form.Item
                label="适用SPU"
                name="spu_ids"
                rules={[{ required: true, message: '请选择至少一个 SPU' }]}
              >
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  filterOption={false}
                  placeholder="请输入 SPU 编码或名称搜索"
                  options={spuOptions}
                  onSearch={setSpuKeyword}
                />
              </Form.Item>
            ) : null}

            {ownershipType === '按分类' ? (
              <Form.Item
                label="适用分类"
                name="category_paths"
                rules={[{ required: true, message: '请选择至少一个分类' }]}
              >
                <Cascader
                  multiple
                  allowClear
                  options={categoryOptions}
                  placeholder="请选择分类"
                  showCheckedStrategy={Cascader.SHOW_CHILD}
                />
              </Form.Item>
            ) : null}
          </FormSectionCard>

          <FormSectionCard title="证书文件">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Upload {...uploadProps}>
                <Button>选择文件</Button>
              </Upload>
              <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                支持 PDF/JPG/PNG，单文件上传
              </div>
              {selectedUploadFile ? (
                <div style={{ color: 'rgba(0,0,0,0.65)', fontSize: 12 }}>
                  已选择：{selectedUploadFile.name}（{formatFileSize(selectedUploadFile.size)}）
                </div>
              ) : null}
              {!selectedUploadFile && uploadedFileMeta.file_name ? (
                <div style={{ color: 'rgba(0,0,0,0.65)', fontSize: 12 }}>
                  当前文件：{uploadedFileMeta.file_name}
                </div>
              ) : null}
            </Space>
          </FormSectionCard>
        </div>
      </Form>

      <FixedActionBar
        onCancel={() => {
          void leaveCurrentTab()
        }}
        onSave={() => {
          void handleSubmit()
        }}
        loading={saveMutation.isPending || detailQuery.isLoading || categoriesQuery.isLoading}
      />
    </div>
  )
}
