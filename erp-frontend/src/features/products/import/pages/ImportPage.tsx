import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  App as AntdApp,
  Alert,
  Button,
  Empty,
  Progress,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadProps } from 'antd/es/upload'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { importsApi } from '../../../../api/imports'
import { FilterCard } from '../../../../components/common'
import { usePermission } from '../../../../hooks/usePermission'
import type {
  ImportTaskProgress,
  ImportTaskType,
  ImportValidationErrorItem,
  ImportValidationResult,
} from '../../../../types/product'

interface ImportTypeOption {
  key: ImportTaskType
  label: string
  description: string
  templateHint: string
}

interface ValidateImportVariables {
  importType: ImportTaskType
  file: File
  workflowId: number
}

interface ImportTabState {
  validationResult: ImportValidationResult | null
  progress: ImportTaskProgress | null
  isConfirming: boolean
  currentFilename: string | null
}

const IMPORT_TYPE_OPTIONS: ImportTypeOption[] = [
  {
    key: 'categories',
    label: '分类',
    description: '导入一级、二级、三级分类基础数据，并校验层级关系和父级编码。',
    templateHint: '适合初始化产品分类树，支持同一文件内多层级分类一起导入。',
  },
  {
    key: 'spus',
    label: 'SPU',
    description: '导入 SPU 基础信息和开票信息，供应商与分类必须先在系统中可用。',
    templateHint: '同一 SPU 可多行维护开票信息，基础字段需要保持一致。',
  },
  {
    key: 'skus',
    label: 'SKU',
    description: '导入 SKU 基础信息、包装明细和报关资料，并自动继承所属 SPU 的关联字段。',
    templateHint: '同一 SKU 可多行维护包装明细，适合历史商品批量初始化。',
  },
]

function createEmptyTabState(): ImportTabState {
  return {
    validationResult: null,
    progress: null,
    isConfirming: false,
    currentFilename: null,
  }
}

const INITIAL_TAB_STATES: Record<ImportTaskType, ImportTabState> = {
  categories: createEmptyTabState(),
  spus: createEmptyTabState(),
  skus: createEmptyTabState(),
}

const INITIAL_WORKFLOW_IDS: Record<ImportTaskType, number> = {
  categories: 0,
  spus: 0,
  skus: 0,
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

  return '操作失败，请稍后重试'
}

function getImportStatusTag(status: string) {
  switch (status) {
    case 'validated':
      return <Tag color="processing">校验通过</Tag>
    case 'failed_validation':
      return <Tag color="error">校验失败</Tag>
    case 'importing':
      return <Tag color="processing">导入中</Tag>
    case 'imported':
      return <Tag color="success">已导入</Tag>
    case 'import_failed':
      return <Tag color="error">导入失败</Tag>
    default:
      return <Tag>{status || '待处理'}</Tag>
  }
}

function triggerFileDownload(blob: Blob, filename: string) {
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(objectUrl)
}

function isTerminalStatus(status?: string) {
  return status === 'imported' || status === 'import_failed'
}

function getProgressError(progress: ImportTaskProgress | null): string | null {
  const error = progress?.result_summary?.error
  return typeof error === 'string' ? error : null
}

function getImportedCount(progress: ImportTaskProgress | null): number | null {
  const importedCount = progress?.result_summary?.imported_count
  return typeof importedCount === 'number' ? importedCount : null
}

async function invalidateImportRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  importType: ImportTaskType,
) {
  await queryClient.invalidateQueries({ queryKey: ['categories-tree'] })

  if (importType === 'categories') {
    await queryClient.invalidateQueries({ queryKey: ['spus-list'] })
    await queryClient.invalidateQueries({ queryKey: ['skus-list'] })
    return
  }

  if (importType === 'spus') {
    await queryClient.invalidateQueries({ queryKey: ['spus-list'] })
    await queryClient.invalidateQueries({ queryKey: ['spu-supplier-options'] })
    await queryClient.invalidateQueries({ queryKey: ['spu-related-skus'] })
    return
  }

  await queryClient.invalidateQueries({ queryKey: ['skus-list'] })
  await queryClient.invalidateQueries({ queryKey: ['spu-related-skus'] })
}

export default function ImportPage() {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const permission = usePermission()
  const workflowIdRef = useRef<Record<ImportTaskType, number>>(INITIAL_WORKFLOW_IDS)
  const [activeType, setActiveType] = useState<ImportTaskType>('categories')
  const [tabStates, setTabStates] = useState<Record<ImportTaskType, ImportTabState>>(INITIAL_TAB_STATES)

  const currentOption = useMemo(
    () => IMPORT_TYPE_OPTIONS.find((option) => option.key === activeType) ?? IMPORT_TYPE_OPTIONS[0],
    [activeType],
  )

  const currentTabState = tabStates[activeType]
  const validationResult = currentTabState.validationResult
  const progress = currentTabState.progress
  const isConfirming = currentTabState.isConfirming
  const currentFilename = currentTabState.currentFilename

  const currentStatus = progress?.status ?? validationResult?.status
  const currentTaskId = validationResult?.task_id ?? progress?.id ?? null
  const currentProgressPercent = progress?.progress_percent ?? validationResult?.progress_percent ?? 0
  const currentTotalRows = progress?.total_rows ?? validationResult?.total_rows ?? 0
  const currentSuccessCount = progress?.valid_rows ?? validationResult?.success_count ?? 0
  const currentFailedCount = progress?.invalid_rows ?? validationResult?.failed_count ?? 0
  const currentErrors: ImportValidationErrorItem[] = progress?.validation_errors ?? validationResult?.errors ?? []
  const canConfirm = Boolean(validationResult?.can_confirm) && !isConfirming && currentStatus === 'validated'
  const importFailedMessage = getProgressError(progress)

  const updateTabState = (
    importType: ImportTaskType,
    updater: (previous: ImportTabState) => ImportTabState,
  ) => {
    setTabStates((previous) => ({
      ...previous,
      [importType]: updater(previous[importType]),
    }))
  }

  const beginWorkflow = (importType: ImportTaskType = activeType) => {
    workflowIdRef.current[importType] += 1
    return workflowIdRef.current[importType]
  }

  const isCurrentWorkflow = (importType: ImportTaskType, workflowId: number) =>
    workflowIdRef.current[importType] === workflowId

  const resetWorkflow = (importType: ImportTaskType = activeType, invalidateCurrent = true) => {
    if (invalidateCurrent) {
      beginWorkflow(importType)
    }
    updateTabState(importType, () => createEmptyTabState())
  }

  const syncTaskProgress = async (
    taskId: number,
    importType: ImportTaskType,
    workflowId: number,
  ) => {
    const nextProgress = await importsApi.getTaskProgress(taskId)

    if (!isCurrentWorkflow(importType, workflowId)) {
      return nextProgress
    }

    updateTabState(importType, (previous) => ({
      ...previous,
      progress: nextProgress,
      validationResult:
        previous.validationResult?.task_id === taskId
          ? {
              ...previous.validationResult,
              status: nextProgress.status,
              progress_percent: nextProgress.progress_percent,
            }
          : previous.validationResult,
      isConfirming: isTerminalStatus(nextProgress.status) ? false : previous.isConfirming,
    }))

    return nextProgress
  }

  const downloadMutation = useMutation({
    mutationFn: (importType: ImportTaskType) => importsApi.downloadTemplate(importType),
    onSuccess: ({ blob, filename }) => {
      triggerFileDownload(blob, filename)
      message.success('模板下载已开始')
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const validateMutation = useMutation<ImportValidationResult, unknown, ValidateImportVariables>({
    mutationFn: ({ importType, file }: ValidateImportVariables) => importsApi.validate(importType, file),
    onSuccess: (result, variables) => {
      if (!isCurrentWorkflow(variables.importType, variables.workflowId)) {
        return
      }

      updateTabState(variables.importType, (previous) => ({
        ...previous,
        validationResult: result,
        progress: null,
        currentFilename: variables.file.name,
      }))

      if (result.failed_count > 0) {
        message.warning(`校验完成，发现 ${result.failed_count} 条失败记录`)
      } else {
        message.success('校验通过，可以确认导入')
      }
    },
    onError: (error, variables) => {
      if (!isCurrentWorkflow(variables.importType, variables.workflowId)) {
        return
      }

      message.error(getErrorMessage(error))
    },
  })

  const confirmMutation = useMutation({
    mutationFn: ({ importType, taskId }: { importType: ImportTaskType; taskId: number }) =>
      importsApi.confirm(importType, { task_id: taskId }),
  })

  useEffect(() => {
    if (!isConfirming || !currentTaskId) {
      return
    }

    const importType = activeType
    const workflowId = workflowIdRef.current[importType]
    let cancelled = false
    let timer: number | undefined

    const pollProgress = async () => {
      try {
        const response = await importsApi.getTaskProgress(currentTaskId)
        if (cancelled || !isCurrentWorkflow(importType, workflowId)) {
          return
        }

        updateTabState(importType, (previous) => ({
          ...previous,
          progress: response,
          validationResult:
            previous.validationResult?.task_id === currentTaskId
              ? {
                  ...previous.validationResult,
                  status: response.status,
                  progress_percent: response.progress_percent,
                }
              : previous.validationResult,
          isConfirming: isTerminalStatus(response.status) ? false : previous.isConfirming,
        }))

        if (isTerminalStatus(response.status)) {
          return
        }
      } catch {
        if (cancelled) {
          return
        }
      }

      timer = window.setTimeout(() => {
        void pollProgress()
      }, 1000)
    }

    void pollProgress()

    return () => {
      cancelled = true
      if (timer !== undefined) {
        window.clearTimeout(timer)
      }
    }
  }, [activeType, currentTaskId, isConfirming])

  const handleTabChange = (nextKey: string) => {
    startTransition(() => {
      setActiveType(nextKey as ImportTaskType)
    })
  }

  const handleDownloadTemplate = () => {
    downloadMutation.mutate(activeType)
  }

  const handleConfirmImport = async () => {
    if (!validationResult) {
      return
    }

    const importType = activeType
    const workflowId = workflowIdRef.current[importType]
    const taskId = validationResult.task_id

    updateTabState(importType, (previous) => ({
      ...previous,
      isConfirming: true,
      progress: {
        id: taskId,
        task_type: validationResult.task_type,
        status: 'importing',
        original_filename: previous.currentFilename,
        total_rows: validationResult.total_rows,
        valid_rows: validationResult.success_count,
        invalid_rows: validationResult.failed_count,
        progress_percent: previous.progress?.progress_percent ?? 0,
        validation_errors: validationResult.errors,
        result_summary: null,
        expires_at: previous.progress?.expires_at ?? null,
        confirmed_at: null,
      },
    }))

    try {
      const result = await confirmMutation.mutateAsync({
        importType,
        taskId,
      })

      if (!isCurrentWorkflow(importType, workflowId)) {
        return
      }

      updateTabState(importType, (previous) => ({
        ...previous,
        isConfirming: false,
        validationResult:
          previous.validationResult?.task_id === taskId
            ? {
                ...previous.validationResult,
                status: result.status,
                progress_percent: result.progress_percent,
              }
            : previous.validationResult,
        progress:
          previous.progress?.id === taskId
            ? {
                ...previous.progress,
                status: result.status,
                progress_percent: result.progress_percent,
                confirmed_at: result.confirmed_at ?? null,
                result_summary: {
                  ...(previous.progress.result_summary ?? {}),
                  imported_count: result.imported_count,
                },
              }
            : previous.progress,
      }))

      await invalidateImportRelatedQueries(queryClient, importType)
      message.success(`导入成功，共 ${result.imported_count} 条`)
    } catch (error) {
      let nextProgress: ImportTaskProgress | null = null

      try {
        nextProgress = await syncTaskProgress(taskId, importType, workflowId)
      } catch {
        if (isCurrentWorkflow(importType, workflowId)) {
          updateTabState(importType, (previous) => ({
            ...previous,
            isConfirming: false,
            progress:
              previous.progress?.id === taskId
                ? {
                    ...previous.progress,
                    status: 'import_failed',
                    result_summary: previous.progress.result_summary ?? { error: getErrorMessage(error) },
                  }
                : previous.progress,
          }))
        }
      }

      if (!isCurrentWorkflow(importType, workflowId)) {
        return
      }

      updateTabState(importType, (previous) => ({
        ...previous,
        isConfirming: false,
      }))

      if (nextProgress?.status === 'imported') {
        const importedCount = getImportedCount(nextProgress) ?? validationResult.success_count
        await invalidateImportRelatedQueries(queryClient, importType)
        message.success(`导入成功，共 ${importedCount} 条`)
        return
      }

      message.error(getProgressError(nextProgress) ?? getErrorMessage(error))
    }
  }

  const uploadProps: UploadProps = {
    accept: '.xlsx',
    showUploadList: false,
    disabled: validateMutation.isPending || isConfirming,
    beforeUpload: (file) => {
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        message.error('仅支持上传 .xlsx 文件')
        return Upload.LIST_IGNORE
      }

      const importType = activeType
      const workflowId = beginWorkflow(importType)
      resetWorkflow(importType, false)
      updateTabState(importType, (previous) => ({
        ...previous,
        currentFilename: file.name,
      }))
      validateMutation.mutate({ importType, file, workflowId })
      return Upload.LIST_IGNORE
    },
  }

  const errorColumns: ColumnsType<ImportValidationErrorItem> = [
    {
      title: '行号',
      dataIndex: 'row_number',
      key: 'row_number',
      width: 100,
    },
    {
      title: '记录标识',
      dataIndex: 'row_key',
      key: 'row_key',
      width: 180,
      render: (value?: string | null) => value || '—',
    },
    {
      title: '字段名',
      dataIndex: 'field',
      key: 'field',
      width: 160,
    },
    {
      title: '错误原因',
      dataIndex: 'message',
      key: 'message',
    },
  ]

  if (!permission.canAccessImport) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="error"
          showIcon
          message="无权访问数据导入"
          description="当前页面仅产品部和管理员可访问，请切换有权限的账号后重试。"
        />
      </div>
    )
  }

  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      <FilterCard>
        <div style={{ display: 'grid', gap: 16 }}>
          <Tabs
            activeKey={activeType}
            onChange={handleTabChange}
            items={IMPORT_TYPE_OPTIONS.map((option) => ({
              key: option.key,
              label: option.label,
            }))}
          />

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <Typography.Text strong style={{ fontSize: 16 }}>
                {currentOption.label}导入
              </Typography.Text>
              <div style={{ marginTop: 6, color: 'rgba(0,0,0,0.65)' }}>{currentOption.description}</div>
              <div style={{ marginTop: 4, color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                {currentOption.templateHint}
              </div>
              {currentFilename ? (
                <div style={{ marginTop: 8, color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                  当前文件：{currentFilename}
                </div>
              ) : null}
            </div>

            <div style={{ paddingBottom: 16 }}>
              <Space wrap>
                <Upload {...uploadProps}>
                  <Button type="primary" loading={validateMutation.isPending} disabled={isConfirming}>
                    上传 Excel
                  </Button>
                </Upload>
                <Button onClick={handleDownloadTemplate} loading={downloadMutation.isPending}>
                  下载模板
                </Button>
              </Space>
            </div>
          </div>
        </div>
      </FilterCard>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
        }}
      >
        {[
          { label: '总记录数', value: currentTotalRows || '—' },
          { label: '校验成功', value: currentSuccessCount || 0 },
          { label: '校验失败', value: currentFailedCount || 0 },
          { label: '当前状态', value: currentStatus ? getImportStatusTag(currentStatus) : '待上传' },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: '#fff',
              border: '1px solid #f0f0f0',
              borderRadius: 4,
              padding: 16,
            }}
          >
            <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>{item.label}</div>
            <div style={{ marginTop: 10, fontSize: 24, fontWeight: 600 }}>
              {typeof item.value === 'string' || typeof item.value === 'number' ? item.value : item.value}
            </div>
          </div>
        ))}
      </section>

      {currentStatus === 'failed_validation' ? (
        <Alert
          type="warning"
          showIcon
          message={
            <span style={{ fontSize: 14, lineHeight: '22px', whiteSpace: 'nowrap' }}>
              校验未通过，请根据下方失败记录修正 Excel 后重新上传。
            </span>
          }
          style={{
            paddingBlock: 8,
            paddingInline: 12,
            background: '#fffaf0',
            borderColor: '#f6dca0',
          }}
        />
      ) : null}

      {currentStatus === 'imported' ? (
        <Alert
          type="success"
          showIcon
          message={
            <span style={{ fontSize: 14, lineHeight: '22px', whiteSpace: 'nowrap' }}>
              导入完成，本次已成功导入 {currentSuccessCount} 条记录。
            </span>
          }
          style={{
            paddingBlock: 8,
            paddingInline: 12,
          }}
        />
      ) : null}

      {currentStatus === 'import_failed' ? (
        <Alert
          type="error"
          showIcon
          message={
            <span style={{ fontSize: 14, lineHeight: '22px', whiteSpace: 'nowrap' }}>
              导入失败，{importFailedMessage || '导入执行失败，请稍后重试或重新上传校验。'}
            </span>
          }
          style={{
            paddingBlock: 8,
            paddingInline: 12,
          }}
        />
      ) : null}

      <section
        style={{
          background: '#fff',
          borderRadius: 4,
          border: '1px solid #f0f0f0',
          padding: 16,
          display: 'grid',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <Typography.Text strong style={{ fontSize: 16 }}>
              导入进度
            </Typography.Text>
            <div style={{ marginTop: 4, color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
              仅在校验通过后可确认导入，导入中会自动刷新进度。
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 720, width: '100%' }}>
          <Progress
            percent={currentProgressPercent}
            status={
              currentStatus === 'import_failed'
                ? 'exception'
                : currentStatus === 'imported'
                  ? 'success'
                  : 'active'
            }
          />
        </div>

        <Space wrap>
          <Button
            type="primary"
            onClick={() => void handleConfirmImport()}
            disabled={!canConfirm}
            loading={confirmMutation.isPending}
          >
            确认导入
          </Button>
          <Button onClick={() => resetWorkflow()} disabled={validateMutation.isPending || isConfirming}>
            清空结果
          </Button>
        </Space>
      </section>

      <section
        style={{
          background: '#fff',
          borderRadius: 4,
          border: '1px solid #f0f0f0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <Typography.Text strong style={{ fontSize: 16 }}>
              失败记录
            </Typography.Text>
            <div style={{ marginTop: 4, color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
              展示本次导入校验返回的逐行错误明细。
            </div>
          </div>
          {currentTaskId ? (
            <Typography.Text type="secondary">任务 ID：{currentTaskId}</Typography.Text>
          ) : null}
        </div>

        {currentErrors.length > 0 ? (
          <Table<ImportValidationErrorItem>
            rowKey={(record) => `${record.row_number}-${record.field}-${record.message}-${record.row_key ?? ''}`}
            columns={errorColumns}
            dataSource={currentErrors}
            pagination={false}
            scroll={{ x: 720 }}
          />
        ) : (
          <div style={{ padding: 32 }}>
            <Empty
              description={
                validationResult || progress ? '当前没有失败记录，可以继续确认导入。' : '请先下载模板并上传 Excel 文件。'
              }
            />
          </div>
        )}
      </section>
    </div>
  )
}
