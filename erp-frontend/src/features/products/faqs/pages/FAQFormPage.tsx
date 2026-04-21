import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Select, Space, Upload, message } from 'antd'
import type { UploadFile, UploadProps } from 'antd/es/upload/interface'
import { useEffect, useMemo, useState } from 'react'
import { useAliveController } from 'react-activation'
import { useNavigate } from 'react-router-dom'
import { faqsApi } from '../../../../api/faqs'
import { filesApi } from '../../../../api/files'
import { spusApi } from '../../../../api/spus'
import { FixedActionBar, FormSectionCard } from '../../../../components/common'
import FormGrid from '../../../../components/form/FormGrid'
import { usePermission } from '../../../../hooks/usePermission'
import { useUIStore } from '../../../../stores/uiStore'
import type { Faq, FaqMutationPayload, SpuListItem } from '../../../../types/product'
import { formatFileSize, uploadFile } from '../../../../utils/upload'

interface FAQFormPageProps {
  mode: 'create' | 'edit'
  faqId: string | null
}

interface FAQFormValues {
  spu_id?: number
  question_type?: string
  question: string
  answer: string
}

const QUESTION_TYPE_OPTIONS = ['售后', '安装', '使用', '配置', '其他'].map((value) => ({
  label: value,
  value,
}))

const DEFAULT_FORM_VALUES: FAQFormValues = {
  spu_id: undefined,
  question_type: undefined,
  question: '',
  answer: '',
}

function getCurrentPath(mode: 'create' | 'edit', faqId: string | null): string {
  if (mode === 'edit' && faqId) {
    return `/products/faqs/${faqId}/edit`
  }
  return '/products/faqs/new'
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

function buildSpuOptionLabel(spu: Pick<SpuListItem, 'code' | 'name'>): string {
  return `${spu.code} | ${spu.name}`
}

export function toFAQFormValues(faq: Faq): FAQFormValues {
  return {
    spu_id: faq.spu_id ?? undefined,
    question_type: faq.question_type ?? undefined,
    question: faq.question,
    answer: faq.answer,
  }
}

export function toFaqMutationPayload(
  values: FAQFormValues,
  attachmentMeta: Pick<FaqMutationPayload, 'attachment_object_key' | 'attachment_file_url' | 'attachment_file_name'>,
): FaqMutationPayload {
  return {
    spu_id: values.spu_id ?? null,
    question_type: values.question_type?.trim() || null,
    question: values.question.trim(),
    answer: values.answer.trim(),
    attachment_object_key: attachmentMeta.attachment_object_key ?? null,
    attachment_file_url: attachmentMeta.attachment_file_url ?? null,
    attachment_file_name: attachmentMeta.attachment_file_name ?? null,
  }
}

export function shouldDeletePreviousFaqAttachment(params: {
  persistedAttachmentObjectKey: string | null
  nextAttachmentObjectKey: string | null
  uploadedObjectKey: string | null
}): boolean {
  const { persistedAttachmentObjectKey, nextAttachmentObjectKey, uploadedObjectKey } = params

  if (!persistedAttachmentObjectKey) {
    return false
  }

  if (uploadedObjectKey) {
    return persistedAttachmentObjectKey !== uploadedObjectKey
  }

  return nextAttachmentObjectKey === null
}

export default function FAQFormPage({ mode, faqId }: FAQFormPageProps) {
  const [form] = Form.useForm<FAQFormValues>()
  const permission = usePermission()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const closeTab = useUIStore((state) => state.closeTab)
  const openTab = useUIStore((state) => state.openTab)
  const { drop } = useAliveController()
  const [spuKeyword, setSpuKeyword] = useState('')
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null)
  const [persistedAttachmentObjectKey, setPersistedAttachmentObjectKey] = useState<string | null>(null)
  const [attachmentMeta, setAttachmentMeta] = useState<{
    attachment_object_key: string | null
    attachment_file_url: string | null
    attachment_file_name: string | null
  }>({
    attachment_object_key: null,
    attachment_file_url: null,
    attachment_file_name: null,
  })

  const currentPath = getCurrentPath(mode, faqId)
  const isEditMode = mode === 'edit'
  const parsedFaqId = faqId ? Number(faqId) : null
  const numericFaqId = parsedFaqId !== null && Number.isFinite(parsedFaqId) ? parsedFaqId : null
  const isInvalidEditTarget = isEditMode && numericFaqId === null
  const canEdit = permission.canCreateProduct

  const detailQuery = useQuery({
    queryKey: ['faq-detail', numericFaqId],
    queryFn: () => faqsApi.getById(numericFaqId as number),
    enabled: isEditMode && numericFaqId !== null,
  })

  const spuOptionsQuery = useQuery({
    queryKey: ['faq-spu-options', spuKeyword],
    queryFn: () =>
      spusApi.list({
        page: 1,
        page_size: 20,
        keyword: spuKeyword.trim() || undefined,
      }),
  })

  useEffect(() => {
    if (!detailQuery.data) {
      return
    }
    form.setFieldsValue(toFAQFormValues(detailQuery.data))
    setPersistedAttachmentObjectKey(detailQuery.data.attachment_object_key ?? null)
    setAttachmentMeta({
      attachment_object_key: detailQuery.data.attachment_object_key ?? null,
      attachment_file_url: detailQuery.data.attachment_file_url ?? null,
      attachment_file_name: detailQuery.data.attachment_file_name ?? null,
    })
    setSelectedUploadFile(null)
  }, [detailQuery.data, form])

  const leaveCurrentTab = async () => {
    openTab({ key: '/products/faqs', label: 'FAQ管理', closable: true })
    navigate('/products/faqs')
    drop(currentPath)
    closeTab(currentPath)
  }

  const spuOptions = useMemo(() => {
    const options = new Map<number, string>()
    for (const item of spuOptionsQuery.data?.items ?? []) {
      options.set(item.id, buildSpuOptionLabel(item))
    }
    if (detailQuery.data?.spu_id && detailQuery.data.spu_code && detailQuery.data.spu_name) {
      options.set(detailQuery.data.spu_id, `${detailQuery.data.spu_code} | ${detailQuery.data.spu_name}`)
    }
    return Array.from(options.entries()).map(([value, label]) => ({ value, label }))
  }, [detailQuery.data, spuOptionsQuery.data?.items])

  const uploadProps: UploadProps = {
    maxCount: 1,
    beforeUpload: (file) => {
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
            uid: 'selected-faq-file',
            name: selectedUploadFile.name,
            size: selectedUploadFile.size,
            status: 'done',
          } as UploadFile,
        ]
      : [],
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FAQFormValues) => {
      let nextAttachmentMeta = attachmentMeta
      let uploadedObjectKey: string | null = null

      try {
        if (selectedUploadFile) {
          const uploaded = await uploadFile(selectedUploadFile, { folder: 'faqs' })
          uploadedObjectKey = uploaded.fileKey
          nextAttachmentMeta = {
            attachment_object_key: uploaded.fileKey,
            attachment_file_url: uploaded.url,
            attachment_file_name: uploaded.filename,
          }
        }

        const payload = toFaqMutationPayload(values, nextAttachmentMeta)
        const savedFaq =
          isEditMode && numericFaqId !== null
            ? await faqsApi.update(numericFaqId, payload)
            : await faqsApi.create(payload)

        if (
          shouldDeletePreviousFaqAttachment({
            persistedAttachmentObjectKey,
            nextAttachmentObjectKey: nextAttachmentMeta.attachment_object_key,
            uploadedObjectKey,
          })
        ) {
          await filesApi.deleteObject(persistedAttachmentObjectKey as string).catch(() => undefined)
        }

        return savedFaq
      } catch (error) {
        if (uploadedObjectKey) {
          await filesApi.deleteObject(uploadedObjectKey).catch(() => undefined)
        }
        throw error
      }
    },
    onSuccess: async (faq) => {
      message.success('保存成功')
      await queryClient.invalidateQueries({ queryKey: ['faqs-list'] })
      queryClient.setQueryData(['faq-detail', faq.id], faq)
      setPersistedAttachmentObjectKey(faq.attachment_object_key ?? null)
      await leaveCurrentTab()
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const handleSubmit = async () => {
    let values: FAQFormValues
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
          <div style={{ fontSize: 16, fontWeight: 600 }}>FAQ 标识无效</div>
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>当前编辑地址缺少有效的 FAQ ID，请返回列表后重新进入。</div>
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
          <div style={{ fontSize: 16, fontWeight: 600 }}>FAQ 数据加载失败</div>
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>请返回 FAQ 列表后重试，或稍后刷新页面。</div>
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
          <div style={{ fontSize: 16, fontWeight: 600 }}>无权编辑 FAQ</div>
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>当前角色仅可查看 FAQ 列表，不能进入新增或编辑页。</div>
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
          <FormSectionCard title="FAQ 信息">
            <FormGrid rowGap={16} columnGap={24}>
              <Form.Item label="适用SPU" name="spu_id">
                <Select
                  allowClear
                  showSearch
                  filterOption={false}
                  placeholder="为空则表示全局 FAQ"
                  options={spuOptions}
                  onSearch={setSpuKeyword}
                />
              </Form.Item>
              <Form.Item label="问题类型" name="question_type">
                <Select
                  allowClear
                  placeholder="请选择问题类型"
                  options={QUESTION_TYPE_OPTIONS}
                />
              </Form.Item>
              <div />
              <Form.Item label="问题" name="question" rules={[{ required: true, message: '请输入问题' }]} style={{ gridColumn: '1 / -1' }}>
                <Input.TextArea placeholder="请输入问题" rows={3} maxLength={200} />
              </Form.Item>
              <Form.Item label="答案" name="answer" rules={[{ required: true, message: '请输入答案' }]} style={{ gridColumn: '1 / -1' }}>
                <Input.TextArea placeholder="请输入答案" rows={5} maxLength={200} />
              </Form.Item>
            </FormGrid>
          </FormSectionCard>

          <FormSectionCard title="附件">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Upload {...uploadProps}>
                <Button>选择附件</Button>
              </Upload>
              <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                FAQ 支持单附件上传
              </div>
              {selectedUploadFile ? (
                <div style={{ color: 'rgba(0,0,0,0.65)', fontSize: 12 }}>
                  已选择：{selectedUploadFile.name}（{formatFileSize(selectedUploadFile.size)}）
                </div>
              ) : null}
              {!selectedUploadFile && attachmentMeta.attachment_file_name ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid #f0f0f0',
                    borderRadius: 4,
                    padding: '8px 12px',
                  }}
                >
                  <a href={attachmentMeta.attachment_file_url ?? '#'} target="_blank" rel="noreferrer">
                    {attachmentMeta.attachment_file_name}
                  </a>
                  <Button
                    type="link"
                    danger
                    onClick={() =>
                      setAttachmentMeta({
                        attachment_object_key: null,
                        attachment_file_url: null,
                        attachment_file_name: null,
                      })
                    }
                  >
                    移除
                  </Button>
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
        loading={saveMutation.isPending || detailQuery.isLoading}
      />
    </div>
  )
}
