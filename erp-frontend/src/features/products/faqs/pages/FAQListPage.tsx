import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Popconfirm, Select, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { faqsApi } from '../../../../api/faqs'
import { spusApi } from '../../../../api/spus'
import { FilterCard, PaginationBar } from '../../../../components/common'
import { usePermission } from '../../../../hooks/usePermission'
import { useUIStore } from '../../../../stores/uiStore'
import type { FaqListItem, FaqListQuery } from '../../../../types/product'

interface FilterValues {
  spu_id?: number
  question_type?: string
  keyword?: string
}

const QUESTION_TYPE_OPTIONS = ['售后', '安装', '使用', '配置', '其他'].map((value) => ({
  label: value,
  value,
}))

export function buildQueryParams(values: FilterValues, pageSize: number): FaqListQuery {
  return {
    page: 1,
    page_size: pageSize,
    spu_id: values.spu_id,
    question_type: values.question_type?.trim() || undefined,
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

export default function FAQListPage() {
  const [form] = Form.useForm<FilterValues>()
  const permission = usePermission()
  const navigate = useNavigate()
  const openTab = useUIStore((state) => state.openTab)
  const queryClient = useQueryClient()
  const [spuKeyword, setSpuKeyword] = useState('')
  const [queryParams, setQueryParams] = useState<FaqListQuery>({
    page: 1,
    page_size: 20,
  })

  const faqsQuery = useQuery({
    queryKey: ['faqs-list', queryParams],
    queryFn: () => faqsApi.list(queryParams),
  })

  const spuOptionsQuery = useQuery({
    queryKey: ['faq-filter-spu-options', spuKeyword],
    queryFn: () =>
      spusApi.list({
        page: 1,
        page_size: 20,
        keyword: spuKeyword.trim() || undefined,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => faqsApi.remove(id),
    onSuccess: async (_, id) => {
      message.success('删除成功')
      await queryClient.invalidateQueries({ queryKey: ['faqs-list'] })
      queryClient.removeQueries({ queryKey: ['faq-detail', id] })
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

  const spuOptions = useMemo(
    () =>
      (spuOptionsQuery.data?.items ?? []).map((item) => ({
        value: item.id,
        label: `${item.code} | ${item.name}`,
      })),
    [spuOptionsQuery.data?.items],
  )

  const columns: ColumnsType<FaqListItem> = [
    {
      title: '问题',
      dataIndex: 'question',
      key: 'question',
      width: 320,
    },
    {
      title: 'SPU',
      key: 'spu',
      width: 220,
      render: (_, record) =>
        record.spu_code && record.spu_name ? `${record.spu_code} | ${record.spu_name}` : '全局',
    },
    {
      title: '问题类型',
      dataIndex: 'question_type',
      key: 'question_type',
      width: 140,
      render: (value?: string | null) => value || '—',
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
      width: 140,
      fixed: 'right',
      render: (_, record) =>
        permission.canCreateProduct ? (
          <Space size={4}>
            <Button
              type="link"
              onClick={() => openRouteTab(`/products/faqs/${record.id}/edit`, '编辑FAQ')}
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除该 FAQ 吗？"
              okText="删除"
              cancelText="取消"
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <Button type="link" danger loading={deleteMutation.isPending}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ) : null,
    },
  ]

  return (
    <div style={{ padding: 16 }}>
      <FilterCard>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            spu_id: undefined,
            question_type: undefined,
            keyword: '',
          }}
          onFinish={handleSearch}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(240px, 1.4fr) minmax(180px, 1fr) minmax(240px, 1.4fr) auto',
              gap: 16,
              alignItems: 'end',
            }}
          >
            <Form.Item label="SPU" name="spu_id">
              <Select
                allowClear
                showSearch
                filterOption={false}
                placeholder="请输入 SPU 编码或名称搜索"
                options={spuOptions}
                onSearch={setSpuKeyword}
              />
            </Form.Item>
            <Form.Item label="问题类型" name="question_type">
              <Select allowClear placeholder="请选择问题类型" options={QUESTION_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item label="关键词" name="keyword">
              <Input placeholder="请输入问题关键词" />
            </Form.Item>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={handleReset}>重置</Button>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
            </div>
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
          <Button type="primary" onClick={() => openRouteTab('/products/faqs/new', '新增FAQ')}>
            新增
          </Button>
        ) : null}
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={faqsQuery.data?.items ?? []}
        loading={faqsQuery.isLoading || spuOptionsQuery.isLoading}
        pagination={false}
        scroll={{ x: 980 }}
      />

      <PaginationBar
        current={queryParams.page}
        pageSize={queryParams.page_size}
        total={faqsQuery.data?.total ?? 0}
        onChange={handlePageChange}
      />
    </div>
  )
}
