import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App as AntdApp, Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { categoriesApi } from '../../../api/categories'
import { pricesApi } from '../../../api/prices'
import { FilterCard, PaginationBar } from '../../../components/common'
import { usePermission } from '../../../hooks/usePermission'
import { useUIStore } from '../../../stores/uiStore'
import type {
  CategoryTreeNode,
  PriceApprovalStatus,
  PriceListItem,
  PriceListQuery,
} from '../../../types/product'

interface FilterValues {
  level1_category_id?: number
  approval_status?: PriceApprovalStatus
  supplier_name?: string
  keyword?: string
}

interface ApprovalStatusMeta {
  color: string
  label: string
}

const APPROVAL_STATUS_META: Record<PriceApprovalStatus, ApprovalStatusMeta> = {
  草稿: { color: '#8c8c8c', label: '草稿' },
  待审批: { color: '#1677ff', label: '待审批' },
  已生效: { color: '#52c41a', label: '已生效' },
  已驳回: { color: '#ff4d4f', label: '已驳回' },
}

const APPROVAL_STATUS_OPTIONS: Array<{ label: string; value: PriceApprovalStatus }> = [
  { label: '草稿', value: '草稿' },
  { label: '待审批', value: '待审批' },
  { label: '已生效', value: '已生效' },
  { label: '已驳回', value: '已驳回' },
]

function toLevel1CategoryOptions(nodes: CategoryTreeNode[]) {
  return nodes.map((node) => ({
    label: node.name,
    value: node.id,
  }))
}

function formatMoney(value?: string | null): string {
  if (value === undefined || value === null || value === '') {
    return '—'
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '—'
}

function getApprovalStatusMeta(status: PriceApprovalStatus): ApprovalStatusMeta {
  return APPROVAL_STATUS_META[status] ?? { color: '#8c8c8c', label: status }
}

export function buildQueryParams(values: FilterValues, pageSize: number): PriceListQuery {
  return {
    page: 1,
    page_size: pageSize,
    level1_category_id: values.level1_category_id,
    approval_status: values.approval_status,
    supplier_name: values.supplier_name?.trim() || undefined,
    keyword: values.keyword?.trim() || undefined,
  }
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

export default function PriceListPage() {
  const [form] = Form.useForm<FilterValues>()
  const { message } = AntdApp.useApp()
  const navigate = useNavigate()
  const permission = usePermission()
  const openTab = useUIStore((state) => state.openTab)
  const queryClient = useQueryClient()
  const [rejectingPrice, setRejectingPrice] = useState<PriceListItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [queryParams, setQueryParams] = useState<PriceListQuery>({
    page: 1,
    page_size: 20,
  })

  const categoriesQuery = useQuery({
    queryKey: ['categories-tree'],
    queryFn: categoriesApi.getTree,
  })

  const pricesQuery = useQuery({
    queryKey: ['prices-list', queryParams],
    queryFn: () => pricesApi.list(queryParams),
  })

  const categoryOptions = toLevel1CategoryOptions(categoriesQuery.data ?? [])

  const openRouteTab = (path: string, label: string) => {
    openTab({ key: path, label, closable: true })
    navigate(path)
  }

  const deleteMutation = useMutation({
    mutationFn: (id: number) => pricesApi.remove(id),
    onSuccess: async (_, id) => {
      message.success('删除成功')
      await queryClient.invalidateQueries({ queryKey: ['prices-list'] })
      queryClient.removeQueries({ queryKey: ['price-detail', id] })
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) => pricesApi.approve(id),
    onSuccess: async (price) => {
      message.success('审批通过')
      await queryClient.invalidateQueries({ queryKey: ['prices-list'] })
      queryClient.setQueryData(['price-detail', price.id], price)
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const submitMutation = useMutation({
    mutationFn: (id: number) => pricesApi.submit(id),
    onSuccess: async (price) => {
      message.success('已提交审批')
      await queryClient.invalidateQueries({ queryKey: ['prices-list'] })
      queryClient.setQueryData(['price-detail', price.id], price)
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      pricesApi.reject(id, { reason }),
    onSuccess: async (price) => {
      message.success('已驳回')
      await queryClient.invalidateQueries({ queryKey: ['prices-list'] })
      queryClient.setQueryData(['price-detail', price.id], price)
      setRejectingPrice(null)
      setRejectReason('')
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const handleSearch = (values: FilterValues) => {
    setQueryParams(buildQueryParams(values, queryParams.page_size))
  }

  const handleReset = () => {
    form.resetFields()
    setQueryParams({
      page: 1,
      page_size: queryParams.page_size,
    })
  }

  const handlePageChange = (page: number, pageSize: number) => {
    const nextParams = buildQueryParams(form.getFieldsValue(), pageSize)
    setQueryParams({
      ...nextParams,
      page,
      page_size: pageSize,
    })
  }

  const openRejectModal = (record: PriceListItem) => {
    setRejectingPrice(record)
    setRejectReason('')
  }

  const handleRejectConfirm = () => {
    const normalizedReason = rejectReason.trim()
    if (!rejectingPrice || !normalizedReason) {
      message.error('请输入驳回原因')
      return
    }

    rejectMutation.mutate({
      id: rejectingPrice.id,
      reason: normalizedReason,
    })
  }

  const columns: ColumnsType<PriceListItem> = [
    {
      title: 'SKU编码',
      dataIndex: 'sku_code',
      key: 'sku_code',
      width: 160,
    },
    {
      title: 'SKU中文名称',
      dataIndex: 'sku_name_zh',
      key: 'sku_name_zh',
      width: 220,
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 180,
    },
    {
      title: '采购价(CNY)',
      dataIndex: 'purchase_price',
      key: 'purchase_price',
      width: 140,
      render: (value?: string | null) => formatMoney(value),
    },
    {
      title: '销售价摘要',
      dataIndex: 'region_summary',
      key: 'region_summary',
      width: 260,
      render: (value: string) => value || '无区域价格',
    },
    {
      title: '审批状态',
      dataIndex: 'approval_status',
      key: 'approval_status',
      width: 160,
      render: (_: PriceApprovalStatus, record) => {
        const meta = getApprovalStatusMeta(record.approval_status)

        return (
          <Space direction="vertical" size={4}>
            <Tag color={meta.color}>{meta.label}</Tag>
            {record.approval_status === '已驳回' && record.rejection_reason ? (
              <Tooltip title={record.rejection_reason}>
                <span style={{ color: '#ff4d4f', fontSize: 12 }}>查看驳回原因</span>
              </Tooltip>
            ) : null}
          </Space>
        )
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 360,
      fixed: 'right',
      render: (_, record) => {
        return (
          <Space size={4} wrap>
            <Button
              type="link"
              onClick={() => openRouteTab(`/prices/${record.id}`, '价格详情')}
            >
              查看
            </Button>

            {permission.canManagePrice &&
            (record.approval_status === '草稿' || record.approval_status === '已驳回') ? (
              <Button
                type="link"
                loading={submitMutation.isPending}
                onClick={() => submitMutation.mutate(record.id)}
              >
                提交审批
              </Button>
            ) : null}

            {permission.canApprovePrice && record.approval_status === '待审批' ? (
              <Button
                type="link"
                loading={approveMutation.isPending}
                onClick={() => approveMutation.mutate(record.id)}
              >
                审批通过
              </Button>
            ) : null}

            {permission.canApprovePrice && record.approval_status === '待审批' ? (
              <Button type="link" danger onClick={() => openRejectModal(record)}>
                驳回
              </Button>
            ) : null}

            {permission.canManagePrice && record.approval_status !== '待审批' ? (
              <Button
                type="link"
                onClick={() => openRouteTab(`/prices/${record.id}/edit`, '编辑价格')}
              >
                {record.approval_status === '已驳回' ? '编辑并重提' : '编辑'}
              </Button>
            ) : null}

            {permission.canManagePrice && record.approval_status !== '待审批' ? (
              <Popconfirm
                title="确认删除该价格记录吗？"
                okText="删除"
                cancelText="取消"
                onConfirm={() => deleteMutation.mutate(record.id)}
              >
                <Button type="link" danger loading={deleteMutation.isPending}>
                  删除
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        )
      },
    },
  ]

  return (
    <div style={{ padding: 16 }}>
      <FilterCard>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            level1_category_id: undefined,
            approval_status: undefined,
            supplier_name: '',
            keyword: '',
          }}
          onFinish={handleSearch}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(180px, 1fr) minmax(180px, 1fr) minmax(200px, 1fr) minmax(260px, 1.4fr) auto',
              gap: 16,
              alignItems: 'end',
            }}
          >
            <Form.Item label="一级分类" name="level1_category_id">
              <Select
                allowClear
                placeholder="请选择一级分类"
                options={categoryOptions}
              />
            </Form.Item>

            <Form.Item label="审批状态" name="approval_status">
              <Select
                allowClear
                placeholder="请选择审批状态"
                options={APPROVAL_STATUS_OPTIONS}
              />
            </Form.Item>

            <Form.Item label="供应商" name="supplier_name">
              <Input placeholder="请输入供应商名称" />
            </Form.Item>

            <Form.Item label="关键词" name="keyword">
              <Input placeholder="请输入 SKU 编码或名称" />
            </Form.Item>

            <Form.Item label=" ">
              <Space>
                <Button type="primary" htmlType="submit">
                  查询
                </Button>
                <Button onClick={handleReset}>重置</Button>
              </Space>
            </Form.Item>
          </div>
        </Form>
      </FilterCard>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div />
        {permission.canManagePrice ? (
          <Button type="primary" onClick={() => openRouteTab('/prices/new', '新增价格')}>
            新增
          </Button>
        ) : null}
      </div>

      <div style={{ background: '#fff', borderRadius: 4, border: '1px solid #f0f0f0', padding: 16 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={pricesQuery.data?.items ?? []}
          loading={pricesQuery.isLoading || categoriesQuery.isLoading}
          pagination={false}
          size="middle"
          scroll={{ x: 1320 }}
        />

        <PaginationBar
          current={queryParams.page}
          pageSize={queryParams.page_size}
          total={pricesQuery.data?.total ?? 0}
          onChange={handlePageChange}
        />
      </div>

      <Modal
        title="驳回价格申请"
        open={Boolean(rejectingPrice)}
        onCancel={() => {
          if (rejectMutation.isPending) {
            return
          }
          setRejectingPrice(null)
          setRejectReason('')
        }}
        onOk={handleRejectConfirm}
        confirmLoading={rejectMutation.isPending}
        okText="确认驳回"
        cancelText="取消"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div style={{ color: 'rgba(0,0,0,0.65)' }}>
            {rejectingPrice ? `${rejectingPrice.sku_code} | ${rejectingPrice.sku_name_zh}` : ''}
          </div>
          <Input.TextArea
            rows={4}
            maxLength={500}
            placeholder="请输入驳回原因"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
          />
        </Space>
      </Modal>
    </div>
  )
}
