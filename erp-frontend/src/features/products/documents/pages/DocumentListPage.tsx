import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Popconfirm, Select, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { documentsApi } from '../../../../api/documents'
import { FilterCard, PaginationBar } from '../../../../components/common'
import { usePermission } from '../../../../hooks/usePermission'
import { useUIStore } from '../../../../stores/uiStore'
import type { DocumentListItem, DocumentListQuery, DocumentOwnershipType } from '../../../../types/product'

interface FilterValues {
  document_type?: string
  ownership_type?: DocumentOwnershipType
  keyword?: string
}

const DOCUMENT_TYPE_OPTIONS = [
  '产品手册',
  '技术参数',
  '使用说明',
  '安装说明',
  '培训资料',
  '其他',
].map((value) => ({ label: value, value }))

const OWNERSHIP_OPTIONS: Array<{ label: DocumentOwnershipType; value: DocumentOwnershipType }> = [
  { label: '通用', value: '通用' },
  { label: '指定SKU', value: '指定SKU' },
  { label: '按分类', value: '按分类' },
]

export function buildQueryParams(values: FilterValues, pageSize: number): DocumentListQuery {
  return {
    page: 1,
    page_size: pageSize,
    document_type: values.document_type?.trim() || undefined,
    ownership_type: values.ownership_type,
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

export default function DocumentListPage() {
  const [form] = Form.useForm<FilterValues>()
  const permission = usePermission()
  const navigate = useNavigate()
  const openTab = useUIStore((state) => state.openTab)
  const queryClient = useQueryClient()
  const [queryParams, setQueryParams] = useState<DocumentListQuery>({
    page: 1,
    page_size: 20,
  })

  const documentsQuery = useQuery({
    queryKey: ['documents-list', queryParams],
    queryFn: () => documentsApi.list(queryParams),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentsApi.remove(id),
    onSuccess: async (_, id) => {
      message.success('删除成功')
      await queryClient.invalidateQueries({ queryKey: ['documents-list'] })
      queryClient.removeQueries({ queryKey: ['document-detail', id] })
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const openRouteTab = (path: string, label: string) => {
    openTab({ key: path, label, closable: true })
    navigate(path)
  }

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

  const columns: ColumnsType<DocumentListItem> = [
    {
      title: '资料名称',
      dataIndex: 'name',
      key: 'name',
      width: 220,
    },
    {
      title: '资料类型',
      dataIndex: 'document_type',
      key: 'document_type',
      width: 140,
      render: (value?: string | null) => value || '—',
    },
    {
      title: '归属类型',
      dataIndex: 'ownership_type',
      key: 'ownership_type',
      width: 140,
      render: (value: DocumentOwnershipType) => <Tag>{value}</Tag>,
    },
    {
      title: '归属范围',
      dataIndex: 'ownership_summary',
      key: 'ownership_summary',
      width: 260,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value: string) => value.slice(0, 10),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            onClick={() => openRouteTab(`/products/documents/${record.id}`, '资料详情')}
          >
            查看
          </Button>
          {permission.canCreateProduct ? (
            <>
              <Button
                type="link"
                onClick={() => openRouteTab(`/products/documents/${record.id}/edit`, '编辑资料')}
              >
                编辑
              </Button>
              <Popconfirm
                title="确认删除该资料吗？"
                okText="删除"
                cancelText="取消"
                onConfirm={() => deleteMutation.mutate(record.id)}
              >
                <Button type="link" danger loading={deleteMutation.isPending}>
                  删除
                </Button>
              </Popconfirm>
            </>
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 16 }}>
      <FilterCard>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            document_type: undefined,
            ownership_type: undefined,
            keyword: '',
          }}
          onFinish={handleSearch}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(180px, 1fr) minmax(180px, 1fr) minmax(240px, 1.4fr) auto',
              gap: 16,
              alignItems: 'end',
            }}
          >
            <Form.Item label="资料类型" name="document_type">
              <Select
                allowClear
                showSearch
                placeholder="请选择资料类型"
                options={DOCUMENT_TYPE_OPTIONS}
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item label="归属类型" name="ownership_type">
              <Select allowClear placeholder="请选择归属类型" options={OWNERSHIP_OPTIONS} />
            </Form.Item>
            <Form.Item label="关键词" name="keyword">
              <Input placeholder="请输入资料名称关键词" />
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
        {permission.canCreateProduct ? (
          <Button type="primary" onClick={() => openRouteTab('/products/documents/new', '新增资料')}>
            新增
          </Button>
        ) : null}
      </div>

      <div style={{ background: '#fff', borderRadius: 4, border: '1px solid #f0f0f0', padding: 16 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={documentsQuery.data?.items ?? []}
          loading={documentsQuery.isLoading}
          pagination={false}
          size="middle"
          scroll={{ x: 1180 }}
        />

        <PaginationBar
          current={queryParams.page}
          pageSize={queryParams.page_size}
          total={documentsQuery.data?.total ?? 0}
          onChange={handlePageChange}
        />
      </div>
    </div>
  )
}
