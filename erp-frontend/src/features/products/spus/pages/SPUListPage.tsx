import { useQuery } from '@tanstack/react-query'
import { Button, Cascader, Form, Input, Space, Table } from 'antd'
import type { DefaultOptionType } from 'antd/es/cascader'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { categoriesApi } from '../../../../api/categories'
import { spusApi } from '../../../../api/spus'
import { FilterCard, PaginationBar } from '../../../../components/common'
import { usePermission } from '../../../../hooks/usePermission'
import { useUIStore } from '../../../../stores/uiStore'
import type { CategoryTreeNode, SpuListItem, SpuListQuery } from '../../../../types/product'

interface FilterValues {
  category_path?: number[]
  supplier_name?: string
  keyword?: string
}

function toCategoryOptions(nodes: CategoryTreeNode[]): DefaultOptionType[] {
  return nodes.map((node) => ({
    value: node.id,
    label: node.name,
    children: toCategoryOptions(node.children),
  }))
}

function findCategoryNameById(nodes: CategoryTreeNode[], id: number): string | null {
  for (const node of nodes) {
    if (node.id === id) return node.name
    const childName = findCategoryNameById(node.children, id)
    if (childName) return childName
  }
  return null
}

function buildQueryParams(values: FilterValues, pageSize: number): SpuListQuery {
  const categoryPath = values.category_path ?? []
  return {
    page: 1,
    page_size: pageSize,
    level1_category_id: categoryPath[0],
    level2_category_id: categoryPath[1],
    level3_category_id: categoryPath[2],
    supplier_name: values.supplier_name?.trim() || undefined,
    keyword: values.keyword?.trim() || undefined,
  }
}

export default function SPUListPage() {
  const [form] = Form.useForm<FilterValues>()
  const permission = usePermission()
  const navigate = useNavigate()
  const openTab = useUIStore((state) => state.openTab)
  const [queryParams, setQueryParams] = useState<SpuListQuery>({
    page: 1,
    page_size: 20,
  })

  const categoriesQuery = useQuery({
    queryKey: ['categories-tree'],
    queryFn: categoriesApi.getTree,
  })

  const spusQuery = useQuery({
    queryKey: ['spus-list', queryParams],
    queryFn: () => spusApi.list(queryParams),
  })

  const categoryTree = categoriesQuery.data ?? []
  const categoryOptions = toCategoryOptions(categoryTree)

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
    const currentValues = form.getFieldsValue()
    const nextParams = buildQueryParams(currentValues, pageSize)
    setQueryParams({
      ...nextParams,
      page,
      page_size: pageSize,
    })
  }

  const columns: ColumnsType<SpuListItem> = [
    {
      title: 'SPU编码',
      dataIndex: 'code',
      key: 'code',
      width: 160,
    },
    {
      title: 'SPU名称',
      dataIndex: 'name',
      key: 'name',
      width: 220,
    },
    {
      title: '三级分类',
      dataIndex: 'level3_category_id',
      key: 'level3_category_id',
      width: 180,
      render: (categoryId: number) => findCategoryNameById(categoryTree, categoryId) ?? '--',
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 180,
    },
    {
      title: 'SKU数量',
      dataIndex: 'sku_count',
      key: 'sku_count',
      width: 120,
      render: (skuCount?: number | null) => skuCount ?? '--',
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
          <Button type="link" onClick={() => openRouteTab(`/products/spus/${record.id}`, 'SPU详情')}>
            查看
          </Button>
          {permission.canCreateProduct ? (
            <Button
              type="link"
              onClick={() => openRouteTab(`/products/spus/${record.id}/edit`, '编辑SPU')}
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
          initialValues={{ category_path: [], supplier_name: undefined, keyword: '' }}
          onFinish={handleSearch}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(240px, 2fr) minmax(200px, 1fr) minmax(220px, 1.4fr) auto',
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

            <Form.Item label="关键词" name="keyword">
              <Input placeholder="请输入SPU编码或名称" />
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
          <Button type="primary" onClick={() => openRouteTab('/products/spus/new', '新增SPU')}>
            新增
          </Button>
        ) : null}
      </div>

      <div style={{ background: '#fff', borderRadius: 4, border: '1px solid #f0f0f0', padding: 16 }}>
        <Table<SpuListItem>
          rowKey="id"
          columns={columns}
          dataSource={spusQuery.data?.items ?? []}
          loading={spusQuery.isLoading || categoriesQuery.isLoading}
          pagination={false}
          size="middle"
          scroll={{ x: 1040 }}
        />

        <PaginationBar
          total={spusQuery.data?.total ?? 0}
          current={queryParams.page}
          pageSize={queryParams.page_size}
          onChange={handlePageChange}
        />
      </div>
    </div>
  )
}
