import { useQuery } from '@tanstack/react-query'
import { Button, Cascader, Form, Input, Select, Space, Table, Tag } from 'antd'
import type { DefaultOptionType } from 'antd/es/cascader'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { categoriesApi } from '../../../../api/categories'
import { skusApi } from '../../../../api/skus'
import { FilterCard, PaginationBar } from '../../../../components/common'
import { usePermission } from '../../../../hooks/usePermission'
import { buildEnumOptions, resolveEnumLabel, useSystemEnumItems } from '../../../../hooks/useSystemEnums'
import { useUIStore } from '../../../../stores/uiStore'
import type {
  CategoryTreeNode,
  SkuListItem,
  SkuListQuery,
  SkuProductStatus,
  SkuProductType,
} from '../../../../types/product'

interface FilterValues {
  category_path?: number[]
  supplier_name?: string
  product_status?: SkuProductStatus
  product_type?: SkuProductType
  keyword?: string
}

function toCategoryOptions(nodes: CategoryTreeNode[]): DefaultOptionType[] {
  return nodes.map((node) => ({
    value: node.id,
    label: node.name,
    children: toCategoryOptions(node.children),
  }))
}

function getStatusColor(status: SkuProductStatus): string {
  switch (status) {
    case '上架':
      return 'success'
    case '下架可售':
      return 'warning'
    case '下架不可售':
      return 'error'
    case '临拓':
      return 'processing'
    default:
      return 'default'
  }
}

export function buildQueryParams(values: FilterValues, pageSize: number): SkuListQuery {
  const categoryPath = values.category_path ?? []
  return {
    page: 1,
    page_size: pageSize,
    level1_category_id: categoryPath[0],
    level2_category_id: categoryPath[1],
    level3_category_id: categoryPath[2],
    supplier_name: values.supplier_name?.trim() || undefined,
    product_status: values.product_status,
    product_type: values.product_type,
    keyword: values.keyword?.trim() || undefined,
  }
}

export default function SKUListPage() {
  const [form] = Form.useForm<FilterValues>()
  const permission = usePermission()
  const navigate = useNavigate()
  const openTab = useUIStore((state) => state.openTab)
  const [queryParams, setQueryParams] = useState<SkuListQuery>({
    page: 1,
    page_size: 20,
  })

  const categoriesQuery = useQuery({
    queryKey: ['categories-tree'],
    queryFn: categoriesApi.getTree,
  })

  const skusQuery = useQuery({
    queryKey: ['skus-list', queryParams],
    queryFn: () => skusApi.list(queryParams),
  })

  const categoryOptions = toCategoryOptions(categoriesQuery.data ?? [])
  const productStatusQuery = useSystemEnumItems('product_status')
  const productTypeQuery = useSystemEnumItems('product_type')
  const productStatusOptions = buildEnumOptions(productStatusQuery.data)
  const productTypeOptions = buildEnumOptions(productTypeQuery.data)

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

  const columns: ColumnsType<SkuListItem> = [
    {
      title: 'SKU编码',
      dataIndex: 'code',
      key: 'code',
      width: 160,
    },
    {
      title: 'SKU中文名称',
      dataIndex: 'name_zh',
      key: 'name_zh',
      width: 220,
    },
    {
      title: '产品型号',
      dataIndex: 'product_model',
      key: 'product_model',
      width: 180,
    },
    {
      title: 'SPU编码',
      dataIndex: 'spu_code',
      key: 'spu_code',
      width: 160,
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 180,
    },
    {
      title: '产品状态',
      dataIndex: 'product_status',
      key: 'product_status',
      width: 140,
      render: (value: SkuProductStatus) => (
        <Tag color={getStatusColor(value)}>{resolveEnumLabel(productStatusQuery.data, value)}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" onClick={() => openRouteTab(`/products/skus/${record.id}`, 'SKU详情')}>
            查看
          </Button>
          {permission.canCreateProduct ? (
            <Button
              type="link"
              onClick={() => openRouteTab(`/products/skus/${record.id}/edit`, '编辑SKU')}
            >
              编辑
            </Button>
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
            category_path: [],
            supplier_name: '',
            product_status: undefined,
            product_type: undefined,
            keyword: '',
          }}
          onFinish={handleSearch}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(260px, 2fr) minmax(180px, 1fr) minmax(160px, 1fr) minmax(160px, 1fr) minmax(220px, 1.4fr) auto',
              gap: 16,
              alignItems: 'end',
            }}
          >
            <Form.Item label="分类" name="category_path">
              <Cascader
                allowClear
                options={categoryOptions}
                placeholder="请选择分类"
                changeOnSelect
              />
            </Form.Item>

            <Form.Item label="供应商" name="supplier_name">
              <Input placeholder="请输入供应商名称" />
            </Form.Item>

            <Form.Item label="产品状态" name="product_status">
              <Select
                allowClear
                data-testid="sku-product-status-select"
                placeholder="请选择产品状态"
                options={productStatusOptions}
                loading={productStatusQuery.isLoading}
              />
            </Form.Item>

            <Form.Item label="产品类型" name="product_type">
              <Select
                allowClear
                data-testid="sku-product-type-select"
                placeholder="请选择产品类型"
                options={productTypeOptions}
                loading={productTypeQuery.isLoading}
              />
            </Form.Item>

            <Form.Item label="关键词" name="keyword">
              <Input placeholder="请输入SKU编码或名称" />
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
          <Button type="primary" onClick={() => openRouteTab('/products/skus/new', '新增SKU')}>
            新增
          </Button>
        ) : null}
      </div>

      <div style={{ background: '#fff', borderRadius: 4, border: '1px solid #f0f0f0', padding: 16 }}>
        <Table<SkuListItem>
          rowKey="id"
          columns={columns}
          dataSource={skusQuery.data?.items ?? []}
          loading={skusQuery.isLoading || categoriesQuery.isLoading}
          pagination={false}
          size="middle"
          scroll={{ x: 1220 }}
        />

        <PaginationBar
          total={skusQuery.data?.total ?? 0}
          current={queryParams.page}
          pageSize={queryParams.page_size}
          onChange={handlePageChange}
        />
      </div>
    </div>
  )
}
