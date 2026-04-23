import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { useAliveController } from 'react-activation'
import { useNavigate } from 'react-router-dom'
import { categoriesApi } from '../../../../api/categories'
import { certificatesApi } from '../../../../api/certificates'
import { faqsApi } from '../../../../api/faqs'
import { skusApi } from '../../../../api/skus'
import { FormSectionCard } from '../../../../components/common'
import { usePermission } from '../../../../hooks/usePermission'
import { resolveEnumLabel, useSystemEnumItems } from '../../../../hooks/useSystemEnums'
import { useUIStore } from '../../../../stores/uiStore'
import { spusApi } from '../../../../api/spus'
import type {
  CategoryTreeNode,
  CertificateListItem,
  CertificateOwnershipType,
  CertificateValidityStatus,
  FaqListItem,
  FaqListQuery,
  SkuListItem,
  SkuListQuery,
  Spu,
} from '../../../../types/product'

interface SPUDetailPageProps {
  spuId: string | null
}

const PAGE_SIZE = 100

function findCategoryNameById(nodes: CategoryTreeNode[], id: number): string | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node.name
    }

    const childName = findCategoryNameById(node.children, id)
    if (childName) {
      return childName
    }
  }

  return null
}

function formatCategoryPath(spu: Spu, categories: CategoryTreeNode[]): string {
  const names = [spu.level1_category_id, spu.level2_category_id, spu.level3_category_id]
    .map((categoryId) => findCategoryNameById(categories, categoryId))
    .filter((value): value is string => Boolean(value))

  return names.length > 0 ? names.join(' / ') : '—'
}

function formatCategoryPathFallback(spu: Spu): string {
  return `分类名称加载失败（分类ID：${spu.level1_category_id} / ${spu.level2_category_id} / ${spu.level3_category_id}）`
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '—'
  }

  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : '—'
}

function getCertificateStatusColor(status: CertificateValidityStatus): string {
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

function dedupeById<T extends { id: number }>(items: T[]): T[] {
  const map = new Map<number, T>()
  items.forEach((item) => {
    map.set(item.id, item)
  })
  return Array.from(map.values())
}

function renderRelationError(message: string) {
  return (
    <Alert
      type="error"
      showIcon
      message={message}
      description="请稍后重试，或刷新页面后重新查看。"
    />
  )
}

async function fetchAllSkuItems(baseParams: Omit<SkuListQuery, 'page' | 'page_size'>): Promise<SkuListItem[]> {
  const items: SkuListItem[] = []
  let page = 1
  let total = 0

  do {
    const response = await skusApi.list({
      ...baseParams,
      page,
      page_size: PAGE_SIZE,
    })

    items.push(...response.items)
    total = response.total
    page += 1
  } while (items.length < total)

  return items
}

async function fetchAllFaqItems(baseParams: Omit<FaqListQuery, 'page' | 'page_size'>): Promise<FaqListItem[]> {
  const items: FaqListItem[] = []
  let page = 1
  let total = 0

  do {
    const response = await faqsApi.list({
      ...baseParams,
      page,
      page_size: PAGE_SIZE,
    })

    items.push(...response.items)
    total = response.total
    page += 1
  } while (items.length < total)

  return items
}

async function fetchAllCertificateItems(
  ownershipType: CertificateOwnershipType,
): Promise<CertificateListItem[]> {
  const items: CertificateListItem[] = []
  let page = 1
  let total = 0

  do {
    const response = await certificatesApi.list({
      page,
      page_size: PAGE_SIZE,
      ownership_type: ownershipType,
    })

    items.push(...response.items)
    total = response.total
    page += 1
  } while (items.length < total)

  return items
}

export default function SPUDetailPage({ spuId }: SPUDetailPageProps) {
  const navigate = useNavigate()
  const permission = usePermission()
  const closeTab = useUIStore((state) => state.closeTab)
  const openTab = useUIStore((state) => state.openTab)
  const { drop } = useAliveController()

  const numericSpuId = useMemo(() => {
    if (!spuId) {
      return null
    }

    const parsed = Number(spuId)
    return Number.isFinite(parsed) ? parsed : null
  }, [spuId])

  const currentPath = spuId ? `/products/spus/${spuId}` : '/products/spus'

  const leaveCurrentTab = async () => {
    openTab({ key: '/products/spus', label: 'SPU管理', closable: true })
    navigate('/products/spus')
    drop(currentPath)
    closeTab(currentPath)
  }

  const detailQuery = useQuery({
    queryKey: ['spu-detail', numericSpuId],
    queryFn: () => spusApi.getById(numericSpuId as number),
    enabled: numericSpuId !== null,
  })

  const categoriesQuery = useQuery({
    queryKey: ['categories-tree'],
    queryFn: categoriesApi.getTree,
  })

  const relatedSkusQuery = useQuery({
    queryKey: ['spu-related-skus', numericSpuId],
    queryFn: () => fetchAllSkuItems({ spu_id: numericSpuId as number }),
    enabled: numericSpuId !== null,
  })

  const relatedFaqsQuery = useQuery({
    queryKey: ['spu-related-faqs', numericSpuId],
    queryFn: async () => {
      const [spuFaqs, allFaqs] = await Promise.all([
        fetchAllFaqItems({ spu_id: numericSpuId as number }),
        fetchAllFaqItems({}),
      ])
      const globalFaqs = allFaqs.filter((item) => item.spu_id == null)

      return dedupeById([...spuFaqs, ...globalFaqs])
    },
    enabled: numericSpuId !== null,
  })

  const relatedCertificatesQuery = useQuery({
    queryKey: [
      'spu-related-certificates',
      numericSpuId,
      detailQuery.data?.level1_category_id,
      detailQuery.data?.level2_category_id,
      detailQuery.data?.level3_category_id,
    ],
    queryFn: async () => {
      const spu = detailQuery.data as Spu
      const categoryIds = [spu.level1_category_id, spu.level2_category_id, spu.level3_category_id]

      const [generalCertificates, directCertificates, categoryCertificates] = await Promise.all([
        fetchAllCertificateItems('通用'),
        fetchAllCertificateItems('SPU归属'),
        fetchAllCertificateItems('按分类'),
      ])

      return dedupeById([
        ...generalCertificates,
        ...directCertificates.filter((item) => item.spu_ids.includes(spu.id)),
        ...categoryCertificates.filter((item) =>
          item.category_ids.some((categoryId) => categoryIds.includes(categoryId)),
        ),
      ])
    },
    enabled: detailQuery.data !== undefined,
  })
  const unitQuery = useSystemEnumItems('unit', numericSpuId !== null)
  const countryRegionQuery = useSystemEnumItems('country_region', numericSpuId !== null)
  const certificateTypeQuery = useSystemEnumItems('certificate_type', numericSpuId !== null)
  const questionTypeQuery = useSystemEnumItems('faq_question_type', numericSpuId !== null)

  const openRouteTab = (path: string, label: string) => {
    openTab({ key: path, label, closable: true })
    navigate(path)
  }

  const skuColumns: ColumnsType<SkuListItem> = [
    {
      title: 'SKU编码',
      dataIndex: 'code',
      key: 'code',
      width: 180,
      render: (value: string, record) => (
        <Button
          type="link"
          style={{ padding: 0 }}
          onClick={() => openRouteTab(`/products/skus/${record.id}`, 'SKU详情')}
        >
          {value}
        </Button>
      ),
    },
    {
      title: 'SKU中文名称',
      dataIndex: 'name_zh',
      key: 'name_zh',
      width: 280,
    },
    {
      title: '产品状态',
      dataIndex: 'product_status',
      key: 'product_status',
      width: 140,
    },
  ]

  const certificateColumns: ColumnsType<CertificateListItem> = [
    {
      title: '证书名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (value: string, record) => (
        <Button
          type="link"
          style={{ padding: 0 }}
          onClick={() => openRouteTab(`/products/certificates/${record.id}`, '证书详情')}
        >
          {value}
        </Button>
      ),
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
      title: '状态',
      dataIndex: 'validity_status',
      key: 'validity_status',
      width: 120,
      render: (value: CertificateValidityStatus) => (
        <Tag color={getCertificateStatusColor(value)}>{value}</Tag>
      ),
    },
  ]

  const faqColumns: ColumnsType<FaqListItem> = [
    {
      title: '问题',
      dataIndex: 'question',
      key: 'question',
      width: 320,
      render: (value: string, record) => (
        <Button
          type="link"
          style={{ padding: 0, textAlign: 'left', height: 'auto', whiteSpace: 'normal' }}
          onClick={() => openRouteTab(`/products/faqs/${record.id}`, 'FAQ详情')}
        >
          {value}
        </Button>
      ),
    },
    {
      title: '问题类型',
      dataIndex: 'question_type',
      key: 'question_type',
      width: 140,
      render: (value?: string | null) => resolveEnumLabel(questionTypeQuery.data, value),
    },
    {
      title: '作用范围',
      dataIndex: 'scope_summary',
      key: 'scope_summary',
    },
  ]

  const invoiceColumns = [
    {
      title: '开票品名',
      dataIndex: 'invoice_name',
      key: 'invoice_name',
      width: 360,
    },
    {
      title: '开票单位',
      dataIndex: 'invoice_unit',
      key: 'invoice_unit',
      width: 180,
      render: (value: string) => resolveEnumLabel(unitQuery.data, value),
    },
    {
      title: '开票型号',
      dataIndex: 'invoice_model',
      key: 'invoice_model',
      width: 240,
    },
    {
      title: '公司主体',
      dataIndex: 'company_subject',
      key: 'company_subject',
      width: 300,
    },
  ]

  if (numericSpuId === null) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="error"
          message="SPU 标识无效"
          description="当前详情地址缺少有效的 SPU ID，请返回列表后重新进入。"
          action={
            <Button type="primary" size="small" onClick={() => void leaveCurrentTab()}>
              返回列表
            </Button>
          }
        />
      </div>
    )
  }

  if (detailQuery.isError) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="error"
          message="SPU 数据加载失败"
          description="请返回 SPU 列表后重试，或稍后刷新页面。"
          action={
            <Button type="primary" size="small" onClick={() => void leaveCurrentTab()}>
              返回列表
            </Button>
          }
        />
      </div>
    )
  }

  if (!detailQuery.data) {
    return <div style={{ padding: 16 }} />
  }

  const spu = detailQuery.data
  const categoryPath = categoriesQuery.isError
    ? formatCategoryPathFallback(spu)
    : formatCategoryPath(spu, categoriesQuery.data ?? [])
  const restrictedCountriesText = spu.restricted_countries?.length
    ? spu.restricted_countries
        .map((value) => resolveEnumLabel(countryRegionQuery.data, value))
        .join('，')
    : '—'

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {categoriesQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="分类信息加载失败"
          description="当前已回退展示分类 ID，请稍后刷新页面重试。"
        />
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Space>
          <Button onClick={() => void leaveCurrentTab()}>返回列表</Button>
          {permission.canCreateProduct ? (
            <Button
              type="primary"
              onClick={() => openRouteTab(`/products/spus/${spu.id}/edit`, '编辑SPU')}
            >
              编辑
            </Button>
          ) : null}
        </Space>
      </div>

      <FormSectionCard title="基础信息">
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="SPU编码">{spu.code}</Descriptions.Item>
          <Descriptions.Item label="SPU名称">{spu.name}</Descriptions.Item>
          <Descriptions.Item label="分类">{categoryPath}</Descriptions.Item>
          <Descriptions.Item label="客户质保期(月)">
            {spu.customer_warranty_months}
          </Descriptions.Item>
          <Descriptions.Item label="单位">{resolveEnumLabel(unitQuery.data, spu.unit)}</Descriptions.Item>
          <Descriptions.Item label="禁止经营国家">
            {restrictedCountriesText}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatDateTime(spu.created_at)}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{formatDateTime(spu.updated_at)}</Descriptions.Item>
        </Descriptions>
      </FormSectionCard>

      <FormSectionCard title="采购信息">
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="供应商">{spu.supplier_name}</Descriptions.Item>
          <Descriptions.Item label="厂家型号">{spu.manufacturer_model}</Descriptions.Item>
          <Descriptions.Item label="采购质保期(月)">
            {spu.purchase_warranty_months ?? '—'}
          </Descriptions.Item>
          {permission.canViewPurchasePrice ? (
            <Descriptions.Item label="采购价（CNY）">
              {spu.purchase_price ?? '—'}
            </Descriptions.Item>
          ) : null}
          <Descriptions.Item
            label="供应商质保说明"
            span={permission.canViewPurchasePrice ? 2 : 3}
          >
            {spu.supplier_warranty_notes || '—'}
          </Descriptions.Item>
        </Descriptions>
      </FormSectionCard>

      <FormSectionCard title="开票信息">
        <Table
          rowKey={(record) => record.id ?? `${record.invoice_name}-${record.sort_order}`}
          columns={invoiceColumns}
          dataSource={spu.invoice_infos ?? []}
          pagination={false}
          size="small"
          tableLayout="fixed"
          locale={{ emptyText: '暂无开票信息' }}
          scroll={{ x: 1080 }}
        />
      </FormSectionCard>

      <FormSectionCard title={`下属SKU（${relatedSkusQuery.data?.length ?? 0}）`}>
        {relatedSkusQuery.isError ? (
          renderRelationError('下属 SKU 加载失败')
        ) : (
          <Table<SkuListItem>
            rowKey="id"
            columns={skuColumns}
            dataSource={relatedSkusQuery.data ?? []}
            loading={relatedSkusQuery.isLoading}
            pagination={false}
            size="small"
            locale={{ emptyText: '暂无下属 SKU' }}
            scroll={{ x: 660 }}
          />
        )}
      </FormSectionCard>

      <FormSectionCard title={`关联证书（${relatedCertificatesQuery.data?.length ?? 0}）`}>
        {relatedCertificatesQuery.isError ? (
          renderRelationError('关联证书加载失败')
        ) : (
          <Table<CertificateListItem>
            rowKey="id"
            columns={certificateColumns}
            dataSource={relatedCertificatesQuery.data ?? []}
            loading={relatedCertificatesQuery.isLoading}
            pagination={false}
            size="small"
            locale={{ emptyText: '暂无关联证书' }}
            scroll={{ x: 860 }}
          />
        )}
      </FormSectionCard>

      <FormSectionCard title={`关联FAQ（${relatedFaqsQuery.data?.length ?? 0}）`}>
        {relatedFaqsQuery.isError ? (
          renderRelationError('关联 FAQ 加载失败')
        ) : (
          <Table<FaqListItem>
            rowKey="id"
            columns={faqColumns}
            dataSource={relatedFaqsQuery.data ?? []}
            loading={relatedFaqsQuery.isLoading}
            pagination={false}
            size="small"
            locale={{ emptyText: '暂无关联 FAQ' }}
            scroll={{ x: 720 }}
          />
        )}
      </FormSectionCard>
    </div>
  )
}
