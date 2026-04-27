import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Space, Table, Tabs, Tag } from 'antd'
import type { TabsProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { useAliveController } from 'react-activation'
import { useNavigate } from 'react-router-dom'
import { categoriesApi } from '../../../../api/categories'
import { certificatesApi } from '../../../../api/certificates'
import { documentsApi } from '../../../../api/documents'
import { faqsApi } from '../../../../api/faqs'
import { pricesApi } from '../../../../api/prices'
import { skusApi } from '../../../../api/skus'
import { spusApi } from '../../../../api/spus'
import { FormSectionCard, InheritedField } from '../../../../components/common'
import { usePermission } from '../../../../hooks/usePermission'
import { resolveEnumLabel, resolveEnumLabels, useSystemEnumItems } from '../../../../hooks/useSystemEnums'
import { useUIStore } from '../../../../stores/uiStore'
import { fetchAllPages } from '../../../../utils/fetchAllPages'
import type {
  CategoryTreeNode,
  CertificateListItem,
  CertificateValidityStatus,
  DocumentListItem,
  FaqListItem,
  PriceDetail,
  PriceRegion,
  Sku,
  SkuPackageDetail,
  SkuProductStatus,
} from '../../../../types/product'

interface SKUDetailPageProps {
  skuId: string | null
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

function formatCategoryPath(
  categoryIds: Array<number | undefined>,
  categories: CategoryTreeNode[],
): string {
  const names = categoryIds
    .filter((value): value is number => typeof value === 'number')
    .map((categoryId) => findCategoryNameById(categories, categoryId))
    .filter((value): value is string => Boolean(value))

  return names.length > 0 ? names.join(' / ') : '—'
}

function formatCategoryPathFallback(categoryIds: number[]): string {
  return `分类名称加载失败（分类ID：${categoryIds.join(' / ')}）`
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return '—'
  }

  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : '—'
}

function formatNumberValue(value?: string | number | null, digits = 2): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : '—'
}

function formatBoolean(value: boolean): string {
  return value ? '是' : '否'
}

function getSkuStatusColor(status: SkuProductStatus | string): string {
  switch (status) {
    case '上架':
      return 'success'
    case '下架可售':
      return 'processing'
    case '下架不可售':
      return 'error'
    case '临拓':
      return 'warning'
    default:
      return 'default'
  }
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

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response &&
    error.response.status === 404
  )
}

function buildSummaryCard(
  sku: Sku,
  productStatusItems: ReturnType<typeof useSystemEnumItems>['data'],
) {
  const productStatusLabel = resolveEnumLabel(productStatusItems, sku.product_status)

  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 4,
        border: '1px solid #f0f0f0',
        padding: 16,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
        }}
      >
        <div>
          <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, marginBottom: 6 }}>SKU编码</div>
          <div style={{ color: 'rgba(0,0,0,0.88)', fontWeight: 600 }}>{sku.code}</div>
        </div>
        <div>
          <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, marginBottom: 6 }}>SKU中文名称</div>
          <div style={{ color: 'rgba(0,0,0,0.88)', fontWeight: 600 }}>{sku.name_zh}</div>
        </div>
        <div>
          <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, marginBottom: 6 }}>产品状态</div>
          <Tag color={getSkuStatusColor(sku.product_status)}>{productStatusLabel}</Tag>
        </div>
        <div>
          <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, marginBottom: 6 }}>SPU编码</div>
          <div style={{ color: 'rgba(0,0,0,0.88)', fontWeight: 600 }}>{sku.spu_code}</div>
        </div>
        <div>
          <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, marginBottom: 6 }}>供应商</div>
          <div style={{ color: 'rgba(0,0,0,0.88)', fontWeight: 600 }}>{sku.supplier_name}</div>
        </div>
      </div>
    </section>
  )
}

function renderPackageDetailsTable(packageDetails: SkuPackageDetail[]) {
  const packageColumns: ColumnsType<SkuPackageDetail> = [
    {
      title: '净重(kg)',
      dataIndex: 'net_weight_kg',
      key: 'net_weight_kg',
      render: (value?: string | null) => formatNumberValue(value, 3),
    },
    {
      title: '毛重(kg)',
      dataIndex: 'gross_weight_kg',
      key: 'gross_weight_kg',
      render: (value?: string | null) => formatNumberValue(value, 3),
    },
    {
      title: '长(cm)',
      dataIndex: 'length_cm',
      key: 'length_cm',
      render: (value?: string | null) => formatNumberValue(value, 2),
    },
    {
      title: '宽(cm)',
      dataIndex: 'width_cm',
      key: 'width_cm',
      render: (value?: string | null) => formatNumberValue(value, 2),
    },
    {
      title: '高(cm)',
      dataIndex: 'height_cm',
      key: 'height_cm',
      render: (value?: string | null) => formatNumberValue(value, 2),
    },
    {
      title: '体积(CBM)',
      dataIndex: 'volume_cbm',
      key: 'volume_cbm',
      render: (value?: string | null) => formatNumberValue(value, 6),
    },
  ]

  return (
    <Table<SkuPackageDetail>
      rowKey={(record) => record.id ?? record.sort_order}
      columns={packageColumns}
      dataSource={packageDetails}
      pagination={false}
      size="small"
      locale={{ emptyText: '暂无包装明细' }}
      scroll={{ x: 760 }}
    />
  )
}

function renderImages(images: Sku['images']) {
  if (images.length === 0) {
    return <div style={{ color: 'rgba(0,0,0,0.45)' }}>暂无产品图片</div>
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 16,
      }}
    >
      {images.map((image) => (
        <a
          key={image.id}
          href={image.file_url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              borderRadius: 4,
              overflow: 'hidden',
              border: '1px solid #f0f0f0',
              background: '#fafafa',
              aspectRatio: '1 / 1',
            }}
          >
            <img
              src={image.file_url}
              alt={image.filename}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(0,0,0,0.65)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {image.filename}
          </div>
        </a>
      ))}
    </div>
  )
}

export default function SKUDetailPage({ skuId }: SKUDetailPageProps) {
  const navigate = useNavigate()
  const permission = usePermission()
  const closeTab = useUIStore((state) => state.closeTab)
  const openTab = useUIStore((state) => state.openTab)
  const { drop } = useAliveController()

  const numericSkuId = useMemo(() => {
    if (!skuId) {
      return null
    }

    const parsed = Number(skuId)
    return Number.isFinite(parsed) ? parsed : null
  }, [skuId])

  const currentPath = skuId ? `/products/skus/${skuId}` : '/products/skus'

  const leaveCurrentTab = async () => {
    openTab({ key: '/products/skus', label: 'SKU管理', closable: true })
    navigate('/products/skus')
    drop(currentPath)
    closeTab(currentPath)
  }

  const detailQuery = useQuery({
    queryKey: ['sku-detail', numericSkuId],
    queryFn: () => skusApi.getById(numericSkuId as number),
    enabled: numericSkuId !== null,
  })

  const categoriesQuery = useQuery({
    queryKey: ['categories-tree'],
    queryFn: categoriesApi.getTree,
  })

  const inheritedSpuQuery = useQuery({
    queryKey: ['sku-detail-inherited-spu', detailQuery.data?.spu_id],
    queryFn: () => spusApi.getById(detailQuery.data?.spu_id as number),
    enabled: typeof detailQuery.data?.spu_id === 'number',
  })

  const relatedCertificatesQuery = useQuery({
    queryKey: [
      'sku-related-certificates',
      numericSkuId,
      detailQuery.data?.spu_id,
      detailQuery.data?.level1_category_id,
      detailQuery.data?.level2_category_id,
      detailQuery.data?.level3_category_id,
    ],
    queryFn: async () =>
      fetchAllPages(
        (page, pageSize) =>
          certificatesApi.list({
            page,
            page_size: pageSize,
            aggregate_spu_id: detailQuery.data?.spu_id,
            aggregate_category_ids: [
              detailQuery.data?.level1_category_id,
              detailQuery.data?.level2_category_id,
              detailQuery.data?.level3_category_id,
            ].filter((value): value is number => typeof value === 'number'),
          }),
        PAGE_SIZE,
      ),
    enabled: detailQuery.data !== undefined,
  })

  const relatedDocumentsQuery = useQuery({
    queryKey: [
      'sku-related-documents',
      numericSkuId,
      detailQuery.data?.level1_category_id,
      detailQuery.data?.level2_category_id,
      detailQuery.data?.level3_category_id,
    ],
    queryFn: async () =>
      fetchAllPages(
        (page, pageSize) =>
          documentsApi.list({
            page,
            page_size: pageSize,
            aggregate_sku_id: detailQuery.data?.id,
            aggregate_category_ids: [
              detailQuery.data?.level1_category_id,
              detailQuery.data?.level2_category_id,
              detailQuery.data?.level3_category_id,
            ].filter((value): value is number => typeof value === 'number'),
          }),
        PAGE_SIZE,
      ),
    enabled: detailQuery.data !== undefined,
  })

  const relatedFaqsQuery = useQuery({
    queryKey: ['sku-related-faqs', numericSkuId, detailQuery.data?.spu_id],
    queryFn: async () =>
      fetchAllPages(
        (page, pageSize) =>
          faqsApi.list({
            page,
            page_size: pageSize,
            aggregate_spu_id: detailQuery.data?.spu_id,
          }),
        PAGE_SIZE,
      ),
    enabled: detailQuery.data !== undefined,
  })

  const effectivePriceQuery = useQuery({
    queryKey: ['sku-effective-price', numericSkuId],
    queryFn: () => pricesApi.getEffectiveBySku(numericSkuId as number),
    enabled: numericSkuId !== null,
    retry: false,
  })

  const productTypeQuery = useSystemEnumItems('product_type', numericSkuId !== null)
  const productStatusQuery = useSystemEnumItems('product_status', numericSkuId !== null)
  const unitQuery = useSystemEnumItems('unit', numericSkuId !== null)
  const packageTypeQuery = useSystemEnumItems('package_type', numericSkuId !== null)
  const countryRegionQuery = useSystemEnumItems('country_region', numericSkuId !== null)

  const openRouteTab = (path: string, label: string) => {
    openTab({ key: path, label, closable: true })
    navigate(path)
  }

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

  const documentColumns: ColumnsType<DocumentListItem> = [
    {
      title: '资料名称',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (value: string, record) => (
        <Button
          type="link"
          style={{ padding: 0 }}
          onClick={() => openRouteTab(`/products/documents/${record.id}`, '资料详情')}
        >
          {value}
        </Button>
      ),
    },
    {
      title: '资料类型',
      dataIndex: 'document_type',
      key: 'document_type',
      width: 140,
      render: (value?: string | null) => value || '—',
    },
    {
      title: '归属范围',
      dataIndex: 'ownership_summary',
      key: 'ownership_summary',
      width: 240,
    },
    {
      title: '附件数',
      key: 'attachments',
      width: 100,
      render: (_, record) => record.attachments.length,
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
      render: (value?: string | null) => value || '—',
    },
    {
      title: '作用范围',
      dataIndex: 'scope_summary',
      key: 'scope_summary',
    },
  ]

  const priceColumns: ColumnsType<PriceRegion> = [
    {
      title: '国家/地区',
      dataIndex: 'country_name',
      key: 'country_name',
      width: 160,
    },
    {
      title: '区域编码',
      dataIndex: 'country_code',
      key: 'country_code',
      width: 120,
    },
    {
      title: '币种',
      dataIndex: 'currency',
      key: 'currency',
      width: 90,
    },
    {
      title: '销售价',
      dataIndex: 'sale_price',
      key: 'sale_price',
      width: 120,
      render: (value: string) => formatNumberValue(value, 2),
    },
    {
      title: '列表价',
      dataIndex: 'list_price',
      key: 'list_price',
      width: 120,
      render: (value: string) => formatNumberValue(value, 2),
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 120,
      render: (value?: string | null) => value || '—',
    },
  ]

  if (numericSkuId === null) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="error"
          message="SKU 标识无效"
          description="当前详情地址缺少有效的 SKU ID，请返回列表后重新进入。"
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
          message="SKU 数据加载失败"
          description="请返回 SKU 列表后重试，或稍后刷新页面。"
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

  const sku = detailQuery.data
  const productTypeLabel = resolveEnumLabel(productTypeQuery.data, sku.product_type)
  const productStatusLabel = resolveEnumLabel(productStatusQuery.data, sku.product_status)
  const unitLabel = resolveEnumLabel(unitQuery.data, sku.unit)
  const packageTypeLabel = resolveEnumLabel(packageTypeQuery.data, sku.package_type)
  const restrictedCountriesText = resolveEnumLabels(countryRegionQuery.data, sku.restricted_countries)
  const categoryIds = [sku.level1_category_id, sku.level2_category_id, sku.level3_category_id]
  const categoryPath = categoriesQuery.isError
    ? formatCategoryPathFallback(categoryIds)
    : formatCategoryPath(categoryIds, categoriesQuery.data ?? [])

  const hasEffectivePriceLoadError =
    effectivePriceQuery.isError && !isNotFoundError(effectivePriceQuery.error)

  const effectivePrice = effectivePriceQuery.data as PriceDetail | undefined

  const baseInfoTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {categoriesQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="分类信息加载失败"
          description="当前已回退展示分类 ID，请稍后刷新页面重试。"
        />
      ) : null}

      {inheritedSpuQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="SPU 继承信息加载失败"
          description="采购价等继承字段暂无法完整展示，请稍后刷新页面重试。"
        />
      ) : null}

      <FormSectionCard title="基础信息">
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="SKU编码">{sku.code}</Descriptions.Item>
          <Descriptions.Item label="SKU中文名称">{sku.name_zh}</Descriptions.Item>
          <Descriptions.Item label="SKU英文名称">{sku.name_en}</Descriptions.Item>
          <Descriptions.Item label="产品型号">{sku.product_model}</Descriptions.Item>
          <Descriptions.Item label="产品类型">{productTypeLabel}</Descriptions.Item>
          <Descriptions.Item label="产品状态">
            <Tag color={getSkuStatusColor(sku.product_status)}>{productStatusLabel}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="SPU">{`${sku.spu_code} | ${sku.spu_name}`}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatDateTime(sku.created_at)}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{formatDateTime(sku.updated_at)}</Descriptions.Item>
        </Descriptions>
      </FormSectionCard>

      <FormSectionCard title="继承字段">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="分类" span={2}>
            <InheritedField value={categoryPath} bordered={false} />
          </Descriptions.Item>
          <Descriptions.Item label="供应商">
            <InheritedField value={sku.supplier_name} bordered={false} />
          </Descriptions.Item>
          <Descriptions.Item label="客户质保期(月)">
            <InheritedField value={sku.customer_warranty_months} bordered={false} />
          </Descriptions.Item>
          <Descriptions.Item label="禁止经营国家" span={2}>
            <InheritedField value={restrictedCountriesText} bordered={false} />
          </Descriptions.Item>
          {permission.canViewPurchasePrice ? (
            <Descriptions.Item label="采购价（CNY）" span={2}>
              <InheritedField
                value={
                  inheritedSpuQuery.isError
                    ? '加载失败'
                    : inheritedSpuQuery.data?.purchase_price ?? '—'
                }
                bordered={false}
              />
            </Descriptions.Item>
          ) : null}
        </Descriptions>
      </FormSectionCard>

      <FormSectionCard title="产品属性">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="核心参数" span={2}>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{sku.core_params}</div>
          </Descriptions.Item>
          <Descriptions.Item label="电气参数" span={2}>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {sku.electrical_params || '—'}
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="原理" span={2}>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{sku.principle}</div>
          </Descriptions.Item>
          <Descriptions.Item label="用途" span={2}>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{sku.usage}</div>
          </Descriptions.Item>
        </Descriptions>
      </FormSectionCard>

      <FormSectionCard title="特殊属性">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="材质">{sku.material || '—'}</Descriptions.Item>
          <Descriptions.Item label="单位">{unitLabel}</Descriptions.Item>
          <Descriptions.Item label="是否带插头">{formatBoolean(sku.has_plug)}</Descriptions.Item>
          <Descriptions.Item label="是否特殊">{formatBoolean(sku.is_special)}</Descriptions.Item>
          <Descriptions.Item label="特殊说明" span={2}>
            {sku.special_notes || '—'}
          </Descriptions.Item>
        </Descriptions>
      </FormSectionCard>

      <FormSectionCard title="包装信息">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="包装类型">{packageTypeLabel}</Descriptions.Item>
          <Descriptions.Item label="装箱数量">{sku.package_quantity ?? '—'}</Descriptions.Item>
        </Descriptions>
      </FormSectionCard>

      <FormSectionCard title="包装明细">
        {renderPackageDetailsTable(sku.package_details ?? [])}
      </FormSectionCard>

      <FormSectionCard title="报关信息">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="HSCODE">{sku.customs_hscode || '—'}</Descriptions.Item>
          <Descriptions.Item label="监管条件">
            {sku.customs_supervision_condition || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="申报要素" span={2}>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {sku.customs_declaration_elements || '—'}
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="退税税点">
            {sku.customs_refund_tax_rate || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="是否已维护">
            {formatBoolean(sku.customs_info_ready)}
          </Descriptions.Item>
        </Descriptions>
      </FormSectionCard>

      <FormSectionCard title="产品图片">{renderImages(sku.images ?? [])}</FormSectionCard>
    </div>
  )

  const tabItems: TabsProps['items'] = [
    {
      key: 'base',
      label: '基础信息',
      children: baseInfoTab,
    },
    {
      key: 'certificates',
      label: '产品证书',
      children: (
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
              scroll={{ x: 920 }}
            />
          )}
        </FormSectionCard>
      ),
    },
    {
      key: 'documents',
      label: '产品资料',
      children: (
        <FormSectionCard title={`关联资料（${relatedDocumentsQuery.data?.length ?? 0}）`}>
          {relatedDocumentsQuery.isError ? (
            renderRelationError('关联资料加载失败')
          ) : (
            <Table<DocumentListItem>
              rowKey="id"
              columns={documentColumns}
              dataSource={relatedDocumentsQuery.data ?? []}
              loading={relatedDocumentsQuery.isLoading}
              pagination={false}
              size="small"
              locale={{ emptyText: '暂无关联资料' }}
              scroll={{ x: 860 }}
            />
          )}
        </FormSectionCard>
      ),
    },
    {
      key: 'faqs',
      label: 'FAQ',
      children: (
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
              scroll={{ x: 760 }}
            />
          )}
        </FormSectionCard>
      ),
    },
    {
      key: 'prices',
      label: '销售价格',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {hasEffectivePriceLoadError ? (
            renderRelationError('销售价格加载失败')
          ) : null}

          <FormSectionCard title="价格摘要">
            <Descriptions column={3} size="small" bordered>
              <Descriptions.Item label="SKU编码">{sku.code}</Descriptions.Item>
              <Descriptions.Item label="SKU中文名称">{sku.name_zh}</Descriptions.Item>
              <Descriptions.Item label="产品状态">
                <Tag color={getSkuStatusColor(sku.product_status)}>{productStatusLabel}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="价格状态">
                {hasEffectivePriceLoadError ? (
                  <Tag color="error">加载失败</Tag>
                ) : effectivePrice ? (
                  <Tag color="success">{effectivePrice.approval_status}</Tag>
                ) : (
                  '暂无已生效价格'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="价格摘要" span={2}>
                {hasEffectivePriceLoadError
                  ? '加载失败'
                  : effectivePrice?.region_summary || '—'}
              </Descriptions.Item>
            </Descriptions>
          </FormSectionCard>

          <FormSectionCard title="区域价格">
            {isNotFoundError(effectivePriceQuery.error) ? (
              <div style={{ color: 'rgba(0,0,0,0.45)' }}>暂无已生效价格</div>
            ) : effectivePrice ? (
              <Table<PriceRegion>
                rowKey={(record) => `${record.country_code}-${record.sort_order}`}
                columns={priceColumns}
                dataSource={effectivePrice.regions ?? []}
                pagination={false}
                size="small"
                locale={{ emptyText: '暂无区域价格' }}
                scroll={{ x: 730 }}
              />
            ) : (
              <div style={{ color: 'rgba(0,0,0,0.45)' }}>暂无已生效价格</div>
            )}
          </FormSectionCard>
        </div>
      ),
    },
  ]

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Space>
          <Button onClick={() => void leaveCurrentTab()}>返回列表</Button>
          {permission.canCreateProduct ? (
            <Button
              type="primary"
              onClick={() => openRouteTab(`/products/skus/${sku.id}/edit`, '编辑SKU')}
            >
              编辑
            </Button>
          ) : null}
        </Space>
      </div>

      {buildSummaryCard(sku, productStatusQuery.data)}

      <div
        style={{
          background: '#fff',
          borderRadius: 4,
          border: '1px solid #f0f0f0',
          padding: 16,
        }}
      >
        <Tabs
          defaultActiveKey="base"
          items={tabItems}
          destroyOnHidden={false}
        />
      </div>
    </div>
  )
}
