import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Popconfirm, Select, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { certificatesApi } from '../../../../api/certificates'
import { FilterCard, PaginationBar } from '../../../../components/common'
import { usePermission } from '../../../../hooks/usePermission'
import { buildEnumOptions, resolveEnumLabel, useSystemEnumItems } from '../../../../hooks/useSystemEnums'
import { useUIStore } from '../../../../stores/uiStore'
import type {
  CertificateListItem,
  CertificateListQuery,
  CertificateOwnershipType,
  CertificateValidityStatus,
} from '../../../../types/product'

interface FilterValues {
  certificate_type?: string
  ownership_type?: CertificateOwnershipType
  validity_status?: CertificateValidityStatus
  keyword?: string
}

const OWNERSHIP_OPTIONS: Array<{ label: CertificateOwnershipType; value: CertificateOwnershipType }> = [
  { label: '通用', value: '通用' },
  { label: 'SPU归属', value: 'SPU归属' },
  { label: '按分类', value: '按分类' },
]

const VALIDITY_STATUS_OPTIONS: Array<{ label: CertificateValidityStatus; value: CertificateValidityStatus }> = [
  { label: '有效', value: '有效' },
  { label: '即将过期', value: '即将过期' },
  { label: '已过期', value: '已过期' },
]

function getStatusColor(status: CertificateValidityStatus): string {
  switch (status) {
    case '有效':
      return 'success'
    case '即将过期':
      return 'warning'
    case '已过期':
      return 'error'
    default:
      return 'default'
  }
}

export function buildQueryParams(values: FilterValues, pageSize: number): CertificateListQuery {
  return {
    page: 1,
    page_size: pageSize,
    certificate_type: values.certificate_type?.trim() || undefined,
    ownership_type: values.ownership_type,
    validity_status: values.validity_status,
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

export default function CertificateListPage() {
  const [form] = Form.useForm<FilterValues>()
  const permission = usePermission()
  const navigate = useNavigate()
  const openTab = useUIStore((state) => state.openTab)
  const queryClient = useQueryClient()
  const [queryParams, setQueryParams] = useState<CertificateListQuery>({
    page: 1,
    page_size: 20,
  })
  const certificateTypeQuery = useSystemEnumItems('certificate_type')

  const certificatesQuery = useQuery({
    queryKey: ['certificates-list', queryParams],
    queryFn: () => certificatesApi.list(queryParams),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => certificatesApi.remove(id),
    onSuccess: async (_, id) => {
      message.success('删除成功')
      await queryClient.invalidateQueries({ queryKey: ['certificates-list'] })
      queryClient.removeQueries({ queryKey: ['certificate-detail', id] })
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

  const columns: ColumnsType<CertificateListItem> = [
    {
      title: '证书名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
    },
    {
      title: '证书编号',
      dataIndex: 'certificate_no',
      key: 'certificate_no',
      width: 180,
    },
    {
      title: '证书类型',
      dataIndex: 'certificate_type',
      key: 'certificate_type',
      width: 140,
      render: (value: string) => resolveEnumLabel(certificateTypeQuery.data, value),
    },
    {
      title: '归属范围',
      dataIndex: 'ownership_summary',
      key: 'ownership_summary',
      width: 240,
    },
    {
      title: '有效期',
      key: 'validity_range',
      width: 220,
      render: (_, record) =>
        `${dayjs(record.valid_from).format('YYYY-MM-DD')} ~ ${dayjs(record.valid_to).format('YYYY-MM-DD')}`,
    },
    {
      title: '状态',
      dataIndex: 'validity_status',
      key: 'validity_status',
      width: 140,
      render: (value: CertificateValidityStatus) => (
        <Tag color={getStatusColor(value)}>{value}</Tag>
      ),
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
            onClick={() =>
              openRouteTab(`/products/certificates/${record.id}`, '证书详情')
            }
          >
            查看
          </Button>
          {permission.canCreateProduct ? (
            <>
              <Button
                type="link"
                onClick={() =>
                  openRouteTab(`/products/certificates/${record.id}/edit`, '编辑证书')
                }
              >
                编辑
              </Button>
              <Popconfirm
                title="确认删除该证书吗？"
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
            certificate_type: undefined,
            ownership_type: undefined,
            validity_status: undefined,
            keyword: '',
          }}
          onFinish={handleSearch}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) minmax(240px, 1.4fr) auto',
              gap: 16,
              alignItems: 'end',
            }}
          >
            <Form.Item label="证书类型" name="certificate_type">
              <Select
                allowClear
                showSearch
                placeholder="请选择证书类型"
                options={buildEnumOptions(certificateTypeQuery.data)}
                loading={certificateTypeQuery.isLoading}
                optionFilterProp="label"
              />
            </Form.Item>

            <Form.Item label="归属类型" name="ownership_type">
              <Select
                allowClear
                placeholder="请选择归属类型"
                options={OWNERSHIP_OPTIONS}
              />
            </Form.Item>

            <Form.Item label="有效状态" name="validity_status">
              <Select
                allowClear
                placeholder="请选择有效状态"
                options={VALIDITY_STATUS_OPTIONS}
              />
            </Form.Item>

            <Form.Item label="关键词" name="keyword">
              <Input placeholder="请输入证书名称或编号" />
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
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          minHeight: 32,
        }}
      >
        {permission.canCreateProduct ? (
          <Button
            type="primary"
            onClick={() => openRouteTab('/products/certificates/new', '新增证书')}
          >
            新增
          </Button>
        ) : null}
      </div>

      <div style={{ background: '#fff', borderRadius: 4, border: '1px solid #f0f0f0', padding: 16 }}>
        <Table<CertificateListItem>
          rowKey="id"
          columns={columns}
          dataSource={certificatesQuery.data?.items ?? []}
          loading={certificatesQuery.isLoading}
          pagination={false}
          size="middle"
          scroll={{ x: 1180 }}
        />

        <PaginationBar
          total={certificatesQuery.data?.total ?? 0}
          current={queryParams.page}
          pageSize={queryParams.page_size}
          onChange={handlePageChange}
        />
      </div>
    </div>
  )
}
