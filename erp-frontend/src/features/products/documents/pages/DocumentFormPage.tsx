import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Cascader,
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
import { useEffect, useMemo, useState } from 'react'
import { useAliveController } from 'react-activation'
import { useNavigate } from 'react-router-dom'
import { categoriesApi } from '../../../../api/categories'
import { documentsApi } from '../../../../api/documents'
import { filesApi } from '../../../../api/files'
import { skusApi } from '../../../../api/skus'
import { FixedActionBar, FormSectionCard } from '../../../../components/common'
import FormGrid from '../../../../components/form/FormGrid'
import { usePermission } from '../../../../hooks/usePermission'
import { buildEnumOptions, useSystemEnumItems } from '../../../../hooks/useSystemEnums'
import { useUIStore } from '../../../../stores/uiStore'
import type {
  CategoryTreeNode,
  Document,
  DocumentAttachment,
  DocumentMutationPayload,
  DocumentOwnershipType,
  SkuListItem,
} from '../../../../types/product'
import { formatFileSize, uploadFile } from '../../../../utils/upload'

interface DocumentFormPageProps {
  mode: 'create' | 'edit'
  documentId: string | null
}

interface DocumentFormValues {
  name: string
  document_type?: string
  content_html?: string
  ownership_type: DocumentOwnershipType
  sku_ids: number[]
  category_paths: number[][]
  applicable_countries: string[]
  remarks?: string
}

interface LocalPendingFile {
  uid: string
  file: File
}

const COUNTRY_REGION_CODE_PATTERN = /^(?:[A-Z]{2}|GLOBAL)$/

const OWNERSHIP_OPTIONS: Array<{ label: DocumentOwnershipType; value: DocumentOwnershipType }> = [
  { label: '通用', value: '通用' },
  { label: '指定SKU', value: '指定SKU' },
  { label: '按分类', value: '按分类' },
]

const DEFAULT_FORM_VALUES: DocumentFormValues = {
  name: '',
  document_type: undefined,
  content_html: '',
  ownership_type: '通用',
  sku_ids: [],
  category_paths: [],
  applicable_countries: [],
  remarks: '',
}

function getCurrentPath(mode: 'create' | 'edit', documentId: string | null): string {
  if (mode === 'edit' && documentId) {
    return `/products/documents/${documentId}/edit`
  }
  return '/products/documents/new'
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

function buildSkuOptionLabel(sku: Pick<SkuListItem, 'code' | 'name_zh'>): string {
  return `${sku.code} | ${sku.name_zh}`
}

export function toDocumentFormValues(
  document: Document,
  categoryTree: CategoryTreeNode[],
): DocumentFormValues {
  return {
    name: document.name,
    document_type: document.document_type ?? undefined,
    content_html: document.content_html ?? '',
    ownership_type: document.ownership_type,
    sku_ids: document.sku_ids ?? [],
    category_paths:
      document.category_ids
        ?.map((categoryId) => findCategoryPath(categoryTree, categoryId))
        .filter((value): value is number[] => Array.isArray(value)) ?? [],
    applicable_countries:
      (document.applicable_countries ?? [])
        .map((item) => item.trim().toUpperCase())
        .filter((item) => COUNTRY_REGION_CODE_PATTERN.test(item)),
    remarks: document.remarks ?? '',
  }
}

export function toDocumentMutationPayload(
  values: DocumentFormValues,
  attachments: DocumentAttachment[],
): DocumentMutationPayload {
  const ownershipType = values.ownership_type
  const categoryPaths = values.category_paths ?? []
  const categoryIds = categoryPaths
    .map((path) => path[path.length - 1])
    .filter((value): value is number => typeof value === 'number')
  const normalizedAttachments = attachments.map((attachment, index) => ({
    object_key: attachment.object_key,
    file_url: attachment.file_url,
    file_name: attachment.file_name,
    sort_order: attachment.sort_order ?? index,
  }))

  return {
    name: values.name.trim(),
    document_type: values.document_type?.trim() || null,
    content_html: values.content_html?.trim() || null,
    ownership_type: ownershipType,
    sku_ids: ownershipType === '指定SKU' ? values.sku_ids ?? [] : [],
    category_ids: ownershipType === '按分类' ? categoryIds : [],
    applicable_countries: (values.applicable_countries ?? [])
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean),
    attachments: normalizedAttachments,
    remarks: values.remarks?.trim() || null,
  }
}

function buildPendingUploadFile(file: LocalPendingFile): UploadFile {
  return {
    uid: file.uid,
    name: file.file.name,
    size: file.file.size,
    status: 'done',
  }
}

function getLocalFileUid(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`
}

export default function DocumentFormPage({ mode, documentId }: DocumentFormPageProps) {
  const [form] = Form.useForm<DocumentFormValues>()
  const permission = usePermission()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const closeTab = useUIStore((state) => state.closeTab)
  const openTab = useUIStore((state) => state.openTab)
  const { drop } = useAliveController()
  const [skuKeyword, setSkuKeyword] = useState('')
  const [existingAttachments, setExistingAttachments] = useState<DocumentAttachment[]>([])
  const [pendingFiles, setPendingFiles] = useState<LocalPendingFile[]>([])

  const currentPath = getCurrentPath(mode, documentId)
  const isEditMode = mode === 'edit'
  const parsedDocumentId = documentId ? Number(documentId) : null
  const numericDocumentId =
    parsedDocumentId !== null && Number.isFinite(parsedDocumentId) ? parsedDocumentId : null
  const isInvalidEditTarget = isEditMode && numericDocumentId === null
  const canEdit = permission.canCreateProduct

  const categoriesQuery = useQuery({
    queryKey: ['categories-tree'],
    queryFn: categoriesApi.getTree,
  })

  const detailQuery = useQuery({
    queryKey: ['document-detail', numericDocumentId],
    queryFn: () => documentsApi.getById(numericDocumentId as number),
    enabled: isEditMode && numericDocumentId !== null,
  })

  const skuOptionsQuery = useQuery({
    queryKey: ['document-sku-options', skuKeyword],
    queryFn: () =>
      skusApi.list({
        page: 1,
        page_size: 20,
        keyword: skuKeyword.trim() || undefined,
      }),
  })

  const documentTypeQuery = useSystemEnumItems('document_type')
  const countryRegionQuery = useSystemEnumItems('country_region')

  useEffect(() => {
    if (!detailQuery.data || categoriesQuery.isLoading) {
      return
    }

    form.setFieldsValue(toDocumentFormValues(detailQuery.data, categoriesQuery.data ?? []))
    setExistingAttachments(detailQuery.data.attachments ?? [])
    setPendingFiles([])
  }, [categoriesQuery.data, categoriesQuery.isLoading, detailQuery.data, form])

  const leaveCurrentTab = async () => {
    openTab({ key: '/products/documents', label: '产品资料', closable: true })
    navigate('/products/documents')
    drop(currentPath)
    closeTab(currentPath)
  }

  const categoryOptions = toCategoryOptions(categoriesQuery.data ?? [])
  const documentTypeOptions = useMemo(
    () =>
      buildEnumOptions(
        documentTypeQuery.data,
        detailQuery.data?.document_type
          ? [{ value: detailQuery.data.document_type, label: detailQuery.data.document_type }]
          : [],
      ),
    [detailQuery.data?.document_type, documentTypeQuery.data],
  )
  const applicableCountryOptions = useMemo(
    () =>
      buildEnumOptions(
        countryRegionQuery.data,
        (detailQuery.data?.applicable_countries ?? []).map((country) => ({
          value: country,
          label: country,
        })),
      ),
    [countryRegionQuery.data, detailQuery.data?.applicable_countries],
  )
  const skuOptions = useMemo(() => {
    const options = new Map<number, string>()
    for (const item of skuOptionsQuery.data?.items ?? []) {
      options.set(item.id, buildSkuOptionLabel(item))
    }
    for (const item of detailQuery.data?.skus ?? []) {
      options.set(item.sku_id, `${item.sku_code} | ${item.sku_name_zh}`)
    }
    return Array.from(options.entries()).map(([value, label]) => ({ value, label }))
  }, [detailQuery.data?.skus, skuOptionsQuery.data?.items])

  const ownershipType = Form.useWatch('ownership_type', form)

  const handleOwnershipTypeChange = (nextType: DocumentOwnershipType) => {
    form.setFieldValue('ownership_type', nextType)
    form.setFieldValue('sku_ids', [])
    form.setFieldValue('category_paths', [])
  }

  const uploadProps: UploadProps = {
    multiple: true,
    beforeUpload: (file) => {
      const uid = getLocalFileUid(file)
      setPendingFiles((prev) =>
        prev.some((item) => item.uid === uid) ? prev : [...prev, { uid, file }])
      return false
    },
    onRemove: (file) => {
      setPendingFiles((prev) => prev.filter((item) => item.uid !== file.uid))
      return true
    },
    fileList: pendingFiles.map(buildPendingUploadFile),
  }

  const saveMutation = useMutation({
    mutationFn: async (values: DocumentFormValues) => {
      const removedExistingObjectKeys = (detailQuery.data?.attachments ?? [])
        .filter(
          (attachment) =>
            !existingAttachments.some((item) => item.object_key === attachment.object_key),
        )
        .map((attachment) => attachment.object_key)

      let uploadedAttachments: DocumentAttachment[] = []
      try {
        uploadedAttachments = await Promise.all(
          pendingFiles.map(async (item, index) => {
            const uploaded = await uploadFile(item.file, { folder: 'product-documents' })
            return {
              object_key: uploaded.fileKey,
              file_url: uploaded.url,
              file_name: uploaded.filename,
              sort_order: existingAttachments.length + index,
            }
          }),
        )

        const payload = toDocumentMutationPayload(values, [
          ...existingAttachments.map((attachment, index) => ({
            ...attachment,
            sort_order: index,
          })),
          ...uploadedAttachments,
        ])

        const savedDocument =
          isEditMode && numericDocumentId !== null
            ? await documentsApi.update(numericDocumentId, payload)
            : await documentsApi.create(payload)

        await Promise.all(
          removedExistingObjectKeys.map((objectKey) =>
            filesApi.deleteObject(objectKey).catch(() => undefined),
          ),
        )

        return savedDocument
      } catch (error) {
        await Promise.all(
          uploadedAttachments.map((attachment) =>
            filesApi.deleteObject(attachment.object_key).catch(() => undefined),
          ),
        )
        throw error
      }
    },
    onSuccess: async (document) => {
      message.success('保存成功')
      await queryClient.invalidateQueries({ queryKey: ['documents-list'] })
      queryClient.setQueryData(['document-detail', document.id], document)
      await leaveCurrentTab()
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const handleSubmit = async () => {
    let values: DocumentFormValues
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

    if (!values.content_html?.trim() && existingAttachments.length === 0 && pendingFiles.length === 0) {
      message.error('资料内容和资料文件至少填写一项')
      return
    }

    try {
      await saveMutation.mutateAsync(values)
    } catch (error) {
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
          <div style={{ fontSize: 16, fontWeight: 600 }}>资料标识无效</div>
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>当前编辑地址缺少有效的资料 ID，请返回列表后重新进入。</div>
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
          <div style={{ fontSize: 16, fontWeight: 600 }}>资料数据加载失败</div>
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>请返回资料列表后重试，或稍后刷新页面。</div>
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
          <div style={{ fontSize: 16, fontWeight: 600 }}>无权编辑资料</div>
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>当前角色仅可查看资料列表，不能进入新增或编辑页。</div>
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
            <FormGrid rowGap={16} columnGap={24}>
              <Form.Item label="资料名称" name="name" rules={[{ required: true, message: '请输入资料名称' }]}>
                <Input placeholder="请输入资料名称" maxLength={100} />
              </Form.Item>
              <Form.Item label="资料类型" name="document_type">
                <Select
                  allowClear
                  showSearch
                  placeholder="请选择资料类型"
                  options={documentTypeOptions}
                  loading={documentTypeQuery.isLoading}
                  optionFilterProp="label"
                />
              </Form.Item>
              <Form.Item label="适用国家/地区" name="applicable_countries">
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="未填写则默认全局适用"
                  options={applicableCountryOptions}
                  loading={countryRegionQuery.isLoading}
                  optionFilterProp="label"
                />
              </Form.Item>
              <Form.Item label="资料内容（HTML）" name="content_html" style={{ gridColumn: '1 / -1' }}>
                <Input.TextArea
                  placeholder="请输入资料内容，支持粘贴富文本 HTML"
                  rows={10}
                  maxLength={20000}
                />
              </Form.Item>
              <Form.Item label="备注" name="remarks" style={{ gridColumn: '1 / -1' }}>
                <Input.TextArea placeholder="请输入备注" rows={3} maxLength={1000} />
              </Form.Item>
            </FormGrid>
          </FormSectionCard>

          <FormSectionCard title="归属信息">
            <Form.Item label="归属类型" name="ownership_type" rules={[{ required: true, message: '请选择归属类型' }]}>
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                options={OWNERSHIP_OPTIONS}
                onChange={(event) => handleOwnershipTypeChange(event.target.value as DocumentOwnershipType)}
              />
            </Form.Item>

            {ownershipType === '指定SKU' ? (
              <Form.Item label="适用SKU" name="sku_ids" rules={[{ required: true, message: '请选择至少一个 SKU' }]}>
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  filterOption={false}
                  placeholder="请输入 SKU 编码或中文名称搜索"
                  options={skuOptions}
                  onSearch={setSkuKeyword}
                />
              </Form.Item>
            ) : null}

            {ownershipType === '按分类' ? (
              <Form.Item label="适用分类" name="category_paths" rules={[{ required: true, message: '请选择至少一个分类' }]}>
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

          <FormSectionCard title="附件列表">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Upload {...uploadProps}>
                <Button>选择文件</Button>
              </Upload>
              <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                支持多文件上传；保存时会统一上传并关联到资料记录
              </div>

              {existingAttachments.length > 0 ? (
                <div>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>当前附件</div>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {existingAttachments.map((attachment) => (
                      <div
                        key={attachment.object_key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          border: '1px solid #f0f0f0',
                          borderRadius: 4,
                          padding: '8px 12px',
                        }}
                      >
                        <a href={attachment.file_url} target="_blank" rel="noreferrer">
                          {attachment.file_name}
                        </a>
                        <Button
                          type="link"
                          danger
                          onClick={() =>
                            setExistingAttachments((prev) =>
                              prev.filter((item) => item.object_key !== attachment.object_key),
                            )
                          }
                        >
                          移除
                        </Button>
                      </div>
                    ))}
                  </Space>
                </div>
              ) : null}

              {pendingFiles.length > 0 ? (
                <div>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>待上传文件</div>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {pendingFiles.map((item) => (
                      <div
                        key={item.uid}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          border: '1px solid #f0f0f0',
                          borderRadius: 4,
                          padding: '8px 12px',
                        }}
                      >
                        <span>
                          {item.file.name}（{formatFileSize(item.file.size)}）
                        </span>
                        <Button
                          type="link"
                          danger
                          onClick={() =>
                            setPendingFiles((prev) => prev.filter((pending) => pending.uid !== item.uid))
                          }
                        >
                          移除
                        </Button>
                      </div>
                    ))}
                  </Space>
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
