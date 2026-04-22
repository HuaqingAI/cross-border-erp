import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useAliveController } from 'react-activation'
import { useNavigate } from 'react-router-dom'
import { pricesApi } from '../../../api/prices'
import { FormSectionCard } from '../../../components/common'
import { usePermission } from '../../../hooks/usePermission'
import { useUIStore } from '../../../stores/uiStore'
import type { PriceApprovalStatus, PriceRegion } from '../../../types/product'

interface PriceDetailPageProps {
  priceId: string | null
}

type DraftChangeStatus = '新增' | '调高' | '调低' | '未变化' | '已修改'

interface DraftComparisonRow extends PriceRegion {
  effective_sale_price?: string | null
  effective_list_price?: string | null
  sale_change_status: DraftChangeStatus
  list_change_status: DraftChangeStatus
}

function formatMoney(value?: string | null): string {
  if (value === undefined || value === null || value === '') {
    return '—'
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '—'
}

function getStatusMeta(status: PriceApprovalStatus): { color: string; label: string } {
  switch (status) {
    case '待审批':
      return { color: '#1677ff', label: '待审批' }
    case '已生效':
      return { color: '#52c41a', label: '已生效' }
    case '已驳回':
      return { color: '#ff4d4f', label: '已驳回' }
    default:
      return { color: '#8c8c8c', label: '草稿' }
  }
}

function getChangeStatusTagColor(status: DraftChangeStatus): string {
  switch (status) {
    case '新增':
      return '#1677ff'
    case '调高':
      return '#fa8c16'
    case '调低':
      return '#52c41a'
    case '未变化':
      return '#8c8c8c'
    default:
      return '#722ed1'
  }
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

function sortRegions(regions: PriceRegion[]): PriceRegion[] {
  return [...regions].sort((left, right) => {
    const sortOrderDiff = left.sort_order - right.sort_order
    if (sortOrderDiff !== 0) {
      return sortOrderDiff
    }
    return left.country_code.localeCompare(right.country_code)
  })
}

function hasSameRegionValue(left: PriceRegion, right: PriceRegion): boolean {
  return (
    left.country_name === right.country_name &&
    left.currency === right.currency &&
    left.sale_price === right.sale_price &&
    left.list_price === right.list_price &&
    (left.remarks ?? '') === (right.remarks ?? '')
  )
}

function compareRegionValue(left?: string | null, right?: string | null): number {
  const leftNumber = Number(left ?? 0)
  const rightNumber = Number(right ?? 0)

  if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) {
    return 0
  }

  if (leftNumber > rightNumber) {
    return 1
  }
  if (leftNumber < rightNumber) {
    return -1
  }
  return 0
}

export function buildDraftComparisonRows(
  draftRegions: PriceRegion[],
  effectiveRegions: PriceRegion[],
): DraftComparisonRow[] {
  const effectiveMap = new Map(effectiveRegions.map((region) => [region.country_code, region]))

  return sortRegions(draftRegions).map((draftRegion) => {
    const effectiveRegion = effectiveMap.get(draftRegion.country_code)

    if (!effectiveRegion) {
      return {
        ...draftRegion,
        effective_sale_price: null,
        effective_list_price: null,
        sale_change_status: '新增',
        list_change_status: '新增',
      }
    }

    const saleDiff = compareRegionValue(draftRegion.sale_price, effectiveRegion.sale_price)
    const listDiff = compareRegionValue(draftRegion.list_price, effectiveRegion.list_price)

    if (hasSameRegionValue(draftRegion, effectiveRegion)) {
      return {
        ...draftRegion,
        effective_sale_price: effectiveRegion.sale_price,
        effective_list_price: effectiveRegion.list_price,
        sale_change_status: '未变化',
        list_change_status: '未变化',
      }
    }

    return {
      ...draftRegion,
      effective_sale_price: effectiveRegion.sale_price,
      effective_list_price: effectiveRegion.list_price,
      sale_change_status:
        saleDiff > 0 ? '调高' : saleDiff < 0 ? '调低' : '未变化',
      list_change_status:
        listDiff > 0 ? '调高' : listDiff < 0 ? '调低' : '未变化',
    }
  })
}

export function buildDeletedRegionRows(
  draftRegions: PriceRegion[],
  effectiveRegions: PriceRegion[],
): PriceRegion[] {
  if (draftRegions.length === 0) {
    return []
  }

  const draftCodes = new Set(draftRegions.map((region) => region.country_code))
  return sortRegions(
    effectiveRegions.filter((region) => !draftCodes.has(region.country_code)),
  )
}

export default function PriceDetailPage({ priceId }: PriceDetailPageProps) {
  const navigate = useNavigate()
  const permission = usePermission()
  const closeTab = useUIStore((state) => state.closeTab)
  const openTab = useUIStore((state) => state.openTab)
  const { drop } = useAliveController()

  const numericPriceId = priceId && Number.isFinite(Number(priceId)) ? Number(priceId) : null
  const currentPath = priceId ? `/prices/${priceId}` : '/prices'

  const leaveCurrentTab = async () => {
    openTab({ key: '/prices', label: '价格管理', closable: true })
    navigate('/prices')
    drop(currentPath)
    closeTab(currentPath)
  }

  const detailQuery = useQuery({
    queryKey: ['price-detail', numericPriceId],
    queryFn: () => pricesApi.getById(numericPriceId as number),
    enabled: numericPriceId !== null,
  })

  const effectiveQuery = useQuery({
    queryKey: ['price-effective-detail', detailQuery.data?.sku_id],
    queryFn: () => pricesApi.getEffectiveBySku(detailQuery.data?.sku_id as number),
    enabled: typeof detailQuery.data?.sku_id === 'number',
    retry: false,
  })

  if (numericPriceId === null) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="error"
          message="价格标识无效"
          description="当前详情地址缺少有效的价格 ID，请返回列表后重新进入。"
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
          message="价格数据加载失败"
          description="请返回价格列表后重试，或稍后刷新页面。"
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

  const price = detailQuery.data
  const statusMeta = getStatusMeta(price.approval_status)
  const canEdit = permission.canManagePrice && price.approval_status !== '待审批'
  const draftRegions =
    price.approval_status === '已生效' ? [] : sortRegions(price.regions ?? [])
  const effectiveRegions = effectiveQuery.data?.regions
    ? sortRegions(effectiveQuery.data.regions)
    : []
  const draftRows = buildDraftComparisonRows(draftRegions, effectiveRegions)
  const deletedRows = buildDeletedRegionRows(draftRegions, effectiveRegions)

  const draftColumns: ColumnsType<DraftComparisonRow> = [
    {
      title: '区域编码',
      dataIndex: 'country_code',
      key: 'country_code',
      width: '9%',
    },
    {
      title: '区域名称',
      dataIndex: 'country_name',
      key: 'country_name',
      width: '13%',
    },
    {
      title: '币种',
      dataIndex: 'currency',
      key: 'currency',
      width: '8%',
    },
    {
      title: '生效销售价',
      dataIndex: 'effective_sale_price',
      key: 'effective_sale_price',
      width: '10%',
      render: (value?: string | null) => formatMoney(value),
    },
    {
      title: '审销售价',
      dataIndex: 'sale_price',
      key: 'sale_price',
      width: '10%',
      render: (value: string) => formatMoney(value),
    },
    {
      title: '销售价变更',
      dataIndex: 'sale_change_status',
      key: 'sale_change_status',
      width: '10%',
      render: (value: DraftChangeStatus) => (
        <Tag color={getChangeStatusTagColor(value)}>{value}</Tag>
      ),
    },
    {
      title: '生效列表价',
      dataIndex: 'effective_list_price',
      key: 'effective_list_price',
      width: '10%',
      render: (value?: string | null) => formatMoney(value),
    },
    {
      title: '审列表价',
      dataIndex: 'list_price',
      key: 'list_price',
      width: '10%',
      render: (value: string) => formatMoney(value),
    },
    {
      title: '列表价变更',
      dataIndex: 'list_change_status',
      key: 'list_change_status',
      width: '10%',
      render: (value: DraftChangeStatus) => (
        <Tag color={getChangeStatusTagColor(value)}>{value}</Tag>
      ),
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      width: '10%',
      render: (value?: string | null) => value || '—',
    },
  ]

  const effectiveColumns: ColumnsType<PriceRegion> = [
    {
      title: '区域编码',
      dataIndex: 'country_code',
      key: 'country_code',
      width: '16%',
    },
    {
      title: '区域名称',
      dataIndex: 'country_name',
      key: 'country_name',
      width: '20%',
    },
    {
      title: '币种',
      dataIndex: 'currency',
      key: 'currency',
      width: '12%',
    },
    {
      title: '生效销售价',
      dataIndex: 'sale_price',
      key: 'sale_price',
      width: '16%',
      render: (value: string) => formatMoney(value),
    },
    {
      title: '生效列表价',
      dataIndex: 'list_price',
      key: 'list_price',
      width: '16%',
      render: (value: string) => formatMoney(value),
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      width: '20%',
      render: (value?: string | null) => value || '—',
    },
  ]

  const deletedColumns: ColumnsType<PriceRegion> = [
    {
      title: '区域编码',
      dataIndex: 'country_code',
      key: 'country_code',
      width: '16%',
    },
    {
      title: '区域名称',
      dataIndex: 'country_name',
      key: 'country_name',
      width: '20%',
    },
    {
      title: '币种',
      dataIndex: 'currency',
      key: 'currency',
      width: '12%',
    },
    {
      title: '当前生效销售价',
      dataIndex: 'sale_price',
      key: 'sale_price',
      width: '16%',
      render: (value: string) => formatMoney(value),
    },
    {
      title: '当前生效列表价',
      dataIndex: 'list_price',
      key: 'list_price',
      width: '16%',
      render: (value: string) => formatMoney(value),
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      width: '20%',
      render: (value?: string | null) => value || '—',
    },
  ]

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Space>
          <Button onClick={() => void leaveCurrentTab()}>返回列表</Button>
          {canEdit ? (
            <Button
              type="primary"
              onClick={() => {
                openTab({ key: `/prices/${price.id}/edit`, label: '编辑价格', closable: true })
                navigate(`/prices/${price.id}/edit`)
              }}
            >
              编辑
            </Button>
          ) : null}
        </Space>
      </div>

      <FormSectionCard title="基础信息">
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="SKU编码">{price.sku_code}</Descriptions.Item>
          <Descriptions.Item label="SKU中文名称">{price.sku_name_zh}</Descriptions.Item>
          <Descriptions.Item label="SKU英文名称">{price.sku_name_en || '—'}</Descriptions.Item>
          <Descriptions.Item label="SPU">{`${price.spu_code} | ${price.spu_name}`}</Descriptions.Item>
          <Descriptions.Item label="供应商">{price.supplier_name}</Descriptions.Item>
          <Descriptions.Item label="采购价(CNY)">{formatMoney(price.purchase_price ?? null)}</Descriptions.Item>
          <Descriptions.Item label="审批状态">
            <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="销售价摘要">{price.region_summary}</Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {dayjs(price.updated_at).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="分类" span={3}>
            {[price.level1_category_name, price.level2_category_name, price.level3_category_name].join(' / ')}
          </Descriptions.Item>
          <Descriptions.Item label="驳回原因" span={3}>
            {price.rejection_reason || '—'}
          </Descriptions.Item>
        </Descriptions>
      </FormSectionCard>

      <FormSectionCard title="当前生效价格">
        <div style={{ marginBottom: 12, color: 'rgba(0,0,0,0.45)' }}>
          业务当前实际使用的价格版本。
        </div>
        {effectiveQuery.isError && !isNotFoundError(effectiveQuery.error) ? (
          <Alert
            type="warning"
            showIcon
            message="当前生效价格加载失败"
            description="请稍后刷新重试。"
          />
        ) : (
          <Table
            rowKey={(record) => record.id ?? `${record.country_code}-${record.sort_order}`}
            columns={effectiveColumns}
            dataSource={effectiveRegions}
            pagination={false}
            size="middle"
            tableLayout="fixed"
            locale={{ emptyText: '暂无已生效价格' }}
          />
        )}
      </FormSectionCard>

      <FormSectionCard title="当前审批稿">
        <div style={{ marginBottom: 12, color: 'rgba(0,0,0,0.45)' }}>
          {price.approval_status === '待审批'
            ? '本次变更正在审批中，尚未生效。'
            : price.approval_status === '草稿'
              ? '当前为草稿版本，尚未提交审批。'
              : price.approval_status === '已驳回'
                ? '当前为已驳回稿件，可继续修改后重新提交。'
                : '当前无审批稿。'}
        </div>
        <Table
          rowKey={(record) => record.id ?? `${record.country_code}-${record.sort_order}`}
          columns={draftColumns}
          dataSource={draftRows}
          pagination={false}
          size="middle"
          tableLayout="fixed"
          locale={{ emptyText: '暂无审批稿区域价格' }}
        />
      </FormSectionCard>

      {deletedRows.length > 0 ? (
        <FormSectionCard title="待删除区域">
          <div style={{ marginBottom: 12, color: 'rgba(0,0,0,0.45)' }}>
            以下区域当前仍在生效，但审批通过后将从价格版本中删除。
          </div>
          <Table
            rowKey={(record) => record.id ?? `${record.country_code}-${record.sort_order}`}
            columns={deletedColumns}
            dataSource={deletedRows}
            pagination={false}
            size="middle"
            tableLayout="fixed"
          />
        </FormSectionCard>
      ) : null}
    </div>
  )
}
