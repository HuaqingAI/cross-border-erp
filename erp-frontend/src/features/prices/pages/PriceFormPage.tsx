import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App as AntdApp, Alert, Button, Form, Input, InputNumber, Select } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useAliveController } from 'react-activation'
import { useNavigate } from 'react-router-dom'
import { categoriesApi } from '../../../api/categories'
import { pricesApi } from '../../../api/prices'
import { skusApi } from '../../../api/skus'
import { spusApi } from '../../../api/spus'
import { FixedActionBar, FormSectionCard, InheritedField } from '../../../components/common'
import FormGrid from '../../../components/form/FormGrid'
import { usePermission } from '../../../hooks/usePermission'
import { useUIStore } from '../../../stores/uiStore'
import type {
  CategoryTreeNode,
  PriceDetail,
  PriceMutationPayload,
  PriceRegionInput,
  SkuListItem,
} from '../../../types/product'

interface PriceFormPageProps {
  mode: 'create' | 'edit'
  priceId: string | null
}

interface PriceRegionFormValue {
  country_code: string
  country_name: string
  currency: string
  sale_price?: number | null
  list_price?: number | null
  remarks?: string | null
}

interface PriceFormValues {
  sku_id?: number
  regions: PriceRegionFormValue[]
}

type SaveIntent = 'draft' | 'submit'

class PartialSubmitError extends Error {
  price: PriceDetail

  constructor(messageText: string, price: PriceDetail) {
    super(messageText)
    this.name = 'PartialSubmitError'
    this.price = price
  }
}

const DEFAULT_REGION_VALUE: PriceRegionFormValue = {
  country_code: 'GLOBAL',
  country_name: '全球',
  currency: 'CNY',
  sale_price: null,
  list_price: null,
  remarks: '',
}

const DEFAULT_FORM_VALUES: PriceFormValues = {
  sku_id: undefined,
  regions: [{ ...DEFAULT_REGION_VALUE }],
}

function getCurrentPath(mode: 'create' | 'edit', priceId: string | null): string {
  if (mode === 'edit' && priceId) {
    return `/prices/${priceId}/edit`
  }

  return '/prices/new'
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

  return '提交失败，请稍后重试'
}

function buildSkuOptionLabel(sku: Pick<SkuListItem, 'code' | 'name_zh'>): string {
  return `${sku.code} | ${sku.name_zh}`
}

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
  categoryTree: CategoryTreeNode[],
  ids: Array<number | undefined>,
  fallbackNames?: string[],
): string {
  const names = ids
    .map((id) => (typeof id === 'number' ? findCategoryNameById(categoryTree, id) : null))
    .filter((value): value is string => Boolean(value))

  if (names.length > 0) {
    return names.join(' / ')
  }

  if (fallbackNames && fallbackNames.length > 0) {
    return fallbackNames.join(' / ')
  }

  return '—'
}

function formatMoney(value?: string | number | null): string {
  if (value === undefined || value === null || value === '') {
    return '—'
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '—'
}

export function toPriceFormValues(detail: PriceDetail): PriceFormValues {
  return {
    sku_id: detail.sku_id,
    regions:
      detail.regions?.map((region) => ({
        country_code: region.country_code,
        country_name: region.country_name,
        currency: region.currency,
        sale_price:
          region.sale_price === undefined || region.sale_price === null
            ? null
            : Number(region.sale_price),
        list_price:
          region.list_price === undefined || region.list_price === null
            ? null
            : Number(region.list_price),
        remarks: region.remarks ?? '',
      })) ?? [{ ...DEFAULT_REGION_VALUE }],
  }
}

export function toPricePayload(values: PriceFormValues): PriceMutationPayload {
  const regions = Array.isArray(values.regions) ? values.regions : []

  return {
    sku_id: values.sku_id as number,
    regions: regions.map<PriceRegionInput>((region, index) => ({
      country_code: region.country_code.trim().toUpperCase(),
      country_name: region.country_name.trim(),
      currency: region.currency.trim().toUpperCase(),
      sale_price: region.sale_price as number,
      list_price: region.list_price as number,
      remarks: region.remarks?.trim() || null,
      sort_order: index,
    })),
  }
}

export default function PriceFormPage({ mode, priceId }: PriceFormPageProps) {
  const [form] = Form.useForm<PriceFormValues>()
  const { message } = AntdApp.useApp()
  const permission = usePermission()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const closeTab = useUIStore((state) => state.closeTab)
  const openTab = useUIStore((state) => state.openTab)
  const { drop } = useAliveController()
  const [skuKeyword, setSkuKeyword] = useState('')

  const isEditMode = mode === 'edit'
  const currentPath = getCurrentPath(mode, priceId)
  const parsedPriceId = priceId ? Number(priceId) : null
  const numericPriceId = parsedPriceId !== null && Number.isFinite(parsedPriceId) ? parsedPriceId : null
  const isInvalidEditTarget = isEditMode && numericPriceId === null
  const selectedSkuId = Form.useWatch('sku_id', form)

  const categoriesQuery = useQuery({
    queryKey: ['categories-tree'],
    queryFn: categoriesApi.getTree,
  })

  const detailQuery = useQuery({
    queryKey: ['price-detail', numericPriceId],
    queryFn: () => pricesApi.getById(numericPriceId as number),
    enabled: isEditMode && numericPriceId !== null,
  })

  const skuOptionsQuery = useQuery({
    queryKey: ['price-sku-options', skuKeyword],
    queryFn: () =>
      skusApi.list({
        page: 1,
        page_size: 20,
        keyword: skuKeyword.trim() || undefined,
      }),
    enabled: !isEditMode,
  })

  const selectedSkuDetailQuery = useQuery({
    queryKey: ['price-form-sku-detail', selectedSkuId],
    queryFn: () => skusApi.getById(selectedSkuId as number),
    enabled: !isEditMode && typeof selectedSkuId === 'number',
  })

  const selectedSpuQuery = useQuery({
    queryKey: ['price-form-spu-detail', selectedSkuDetailQuery.data?.spu_id],
    queryFn: () => spusApi.getById(selectedSkuDetailQuery.data?.spu_id as number),
    enabled: !isEditMode && typeof selectedSkuDetailQuery.data?.spu_id === 'number',
  })

  useEffect(() => {
    if (!detailQuery.data) {
      return
    }

    form.setFieldsValue(toPriceFormValues(detailQuery.data))
  }, [detailQuery.data, form])

  const leaveCurrentTab = async () => {
    openTab({ key: '/prices', label: '价格管理', closable: true })
    navigate('/prices')
    drop(currentPath)
    closeTab(currentPath)
  }

  const skuOptions = useMemo(() => {
    const options = new Map<number, string>()

    for (const item of skuOptionsQuery.data?.items ?? []) {
      options.set(item.id, buildSkuOptionLabel(item))
    }

    if (detailQuery.data) {
      options.set(detailQuery.data.sku_id, `${detailQuery.data.sku_code} | ${detailQuery.data.sku_name_zh}`)
    }

    if (selectedSkuDetailQuery.data) {
      options.set(
        selectedSkuDetailQuery.data.id,
        `${selectedSkuDetailQuery.data.code} | ${selectedSkuDetailQuery.data.name_zh}`,
      )
    }

    return Array.from(options.entries()).map(([value, label]) => ({ value, label }))
  }, [detailQuery.data, selectedSkuDetailQuery.data, skuOptionsQuery.data?.items])

  const currentSnapshot = useMemo(() => {
    if (detailQuery.data) {
      return {
        sku_code: detailQuery.data.sku_code,
        sku_name_zh: detailQuery.data.sku_name_zh,
        sku_name_en: detailQuery.data.sku_name_en,
        spu_code: detailQuery.data.spu_code,
        spu_name: detailQuery.data.spu_name,
        supplier_name: detailQuery.data.supplier_name,
        product_model: detailQuery.data.product_model,
        product_status: detailQuery.data.product_status,
        level1_category_id: detailQuery.data.level1_category_id,
        level2_category_id: detailQuery.data.level2_category_id,
        level3_category_id: detailQuery.data.level3_category_id,
        level1_category_name: detailQuery.data.level1_category_name,
        level2_category_name: detailQuery.data.level2_category_name,
        level3_category_name: detailQuery.data.level3_category_name,
        purchase_price: detailQuery.data.purchase_price ?? null,
      }
    }

    if (selectedSkuDetailQuery.data) {
      return {
        sku_code: selectedSkuDetailQuery.data.code,
        sku_name_zh: selectedSkuDetailQuery.data.name_zh,
        sku_name_en: selectedSkuDetailQuery.data.name_en,
        spu_code: selectedSkuDetailQuery.data.spu_code,
        spu_name: selectedSkuDetailQuery.data.spu_name,
        supplier_name: selectedSkuDetailQuery.data.supplier_name,
        product_model: selectedSkuDetailQuery.data.product_model,
        product_status: selectedSkuDetailQuery.data.product_status,
        level1_category_id: selectedSkuDetailQuery.data.level1_category_id,
        level2_category_id: selectedSkuDetailQuery.data.level2_category_id,
        level3_category_id: selectedSkuDetailQuery.data.level3_category_id,
        level1_category_name: undefined,
        level2_category_name: undefined,
        level3_category_name: undefined,
        purchase_price: selectedSpuQuery.data?.purchase_price ?? null,
      }
    }

    return null
  }, [detailQuery.data, selectedSkuDetailQuery.data, selectedSpuQuery.data?.purchase_price])

  const categoryPathText = formatCategoryPath(
    categoriesQuery.data ?? [],
    [
      currentSnapshot?.level1_category_id,
      currentSnapshot?.level2_category_id,
      currentSnapshot?.level3_category_id,
    ],
    currentSnapshot
      ? [
          currentSnapshot.level1_category_name,
          currentSnapshot.level2_category_name,
          currentSnapshot.level3_category_name,
        ].filter((value): value is string => Boolean(value))
      : undefined,
  )

  const saveMutation = useMutation({
    mutationFn: async ({ values, intent }: { values: PriceFormValues; intent: SaveIntent }) => {
      const payload = toPricePayload(values)
      const savedPrice =
        isEditMode && numericPriceId !== null
          ? await pricesApi.update(numericPriceId, payload)
          : await pricesApi.create(payload)

      if (intent === 'draft') {
        return { price: savedPrice, intent }
      }

      try {
        const submittedPrice = await pricesApi.submit(savedPrice.id)
        return { price: submittedPrice, intent }
      } catch (error) {
        const latestPrice = await pricesApi.getById(savedPrice.id).catch(() => savedPrice)

        if (latestPrice.approval_status === '待审批') {
          return { price: latestPrice, intent }
        }

        throw new PartialSubmitError(
          `价格已保存，但提交审批失败：${getErrorMessage(error)}`,
          latestPrice,
        )
      }
    },
    onSuccess: async ({ price, intent }) => {
      await queryClient.invalidateQueries({ queryKey: ['prices-list'] })
      queryClient.setQueryData(['price-detail', price.id], price)

      if (intent === 'draft') {
        message.success('草稿已保存')
        await leaveCurrentTab()
        return
      }

      message.success('提交成功，状态已更新为待审批')
      await leaveCurrentTab()
    },
    onError: (error) => {
      if (error instanceof PartialSubmitError) {
        void queryClient.invalidateQueries({ queryKey: ['prices-list'] })
        queryClient.setQueryData(['price-detail', error.price.id], error.price)

        if (!isEditMode) {
          const recoveryPath = `/prices/${error.price.id}/edit`
          openTab({ key: recoveryPath, label: '编辑价格', closable: true })
          navigate(recoveryPath)
          drop(currentPath)
          closeTab(currentPath)
        }

        message.error(error.message)
        return
      }

      message.error(getErrorMessage(error))
    },
  })

  const handleSubmitAction = async (intent: SaveIntent) => {
    let values: PriceFormValues

    try {
      values = await form.validateFields()
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'errorFields' in error &&
        Array.isArray((error as { errorFields?: Array<{ name: Array<string | number> }> }).errorFields)
      ) {
        const firstField = (error as { errorFields: Array<{ name: Array<string | number> }> }).errorFields[0]
        if (firstField?.name) {
          form.scrollToField(firstField.name, { behavior: 'smooth', block: 'center' })
        }
        return
      }

      message.error(getErrorMessage(error))
      return
    }

    try {
      await saveMutation.mutateAsync({ values, intent })
    } catch (error) {
      window.console.error(error)
    }
  }

  if (isInvalidEditTarget) {
    return (
      <div style={{ padding: 16 }}>
        <div
          style={{
            minHeight: 320,
            background: '#fff',
            borderRadius: 4,
            border: '1px solid #f0f0f0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600 }}>价格标识无效</div>
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>当前编辑地址缺少有效的价格 ID，请返回列表后重新进入。</div>
          <Button type="primary" onClick={() => void leaveCurrentTab()}>
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  if (!permission.canManagePrice) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="warning"
          showIcon
          message="当前角色没有价格编辑权限"
          description="价格新增、编辑与重新提交仅对财务部和管理员开放。"
          action={
            <Button size="small" type="primary" onClick={() => void leaveCurrentTab()}>
              返回列表
            </Button>
          }
        />
      </div>
    )
  }

  if (isEditMode && detailQuery.isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 4, border: '1px solid #f0f0f0', padding: 24 }}>
          价格数据加载中...
        </div>
      </div>
    )
  }

  if (isEditMode && detailQuery.isError) {
    return (
      <div style={{ padding: 16 }}>
        <div
          style={{
            minHeight: 320,
            background: '#fff',
            borderRadius: 4,
            border: '1px solid #f0f0f0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600 }}>价格数据加载失败</div>
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>请稍后重试，或返回列表重新进入。</div>
          <Button type="primary" onClick={() => void leaveCurrentTab()}>
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  if (isEditMode && detailQuery.data?.approval_status === '待审批') {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="info"
          showIcon
          message="待审批价格不可编辑"
          description="当前价格正在审批中，请等待审批结果后再处理。"
          action={
            <Button size="small" type="primary" onClick={() => void leaveCurrentTab()}>
              返回列表
            </Button>
          }
        />
      </div>
    )
  }

  const formInitialValues =
    isEditMode && detailQuery.data ? toPriceFormValues(detailQuery.data) : DEFAULT_FORM_VALUES

  return (
    <div
      style={{
        padding: 16,
        minHeight: 360,
        paddingBottom: 96,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {isEditMode && detailQuery.data?.approval_status === '已驳回' && detailQuery.data.rejection_reason ? (
        <Alert
          type="error"
          showIcon
          message="当前记录已驳回"
          description={`驳回原因：${detailQuery.data.rejection_reason}`}
        />
      ) : null}

      {isEditMode && detailQuery.data?.approval_status === '已生效' ? (
        <Alert
          type="info"
          showIcon
          message="编辑已生效价格后，将重新提交审批"
          description="原已生效价格会继续生效，直到本次改动再次审批通过。"
        />
      ) : null}

      <Form
        key={isEditMode ? `edit-${numericPriceId}-${detailQuery.data?.updated_at ?? 'ready'}` : 'new'}
        form={form}
        layout="vertical"
        initialValues={formInitialValues}
        scrollToFirstError
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <FormSectionCard title="基础信息">
          <FormGrid rowGap={16} columnGap={24} itemStyle={{ marginBottom: 0 }}>
            <Form.Item
              label="选择SKU"
              name="sku_id"
              rules={[{ required: true, message: '请选择 SKU' }]}
            >
              <Select
                showSearch
                allowClear={false}
                disabled={isEditMode}
                filterOption={false}
                options={skuOptions}
                placeholder="请输入关键词搜索 SKU"
                onSearch={setSkuKeyword}
                notFoundContent={skuOptionsQuery.isLoading ? '正在搜索 SKU...' : '暂无匹配 SKU'}
              />
            </Form.Item>

            <Form.Item label="SKU编码">
              <InheritedField value={currentSnapshot?.sku_code ?? '—'} sourceLabel="自动带出" />
            </Form.Item>

            <Form.Item label="SKU中文名称">
              <InheritedField value={currentSnapshot?.sku_name_zh ?? '—'} sourceLabel="自动带出" />
            </Form.Item>

            <Form.Item label="SKU英文名称">
              <InheritedField value={currentSnapshot?.sku_name_en ?? '—'} sourceLabel="自动带出" />
            </Form.Item>

            <Form.Item label="SPU">
              <InheritedField
                value={
                  currentSnapshot
                    ? `${currentSnapshot.spu_code} | ${currentSnapshot.spu_name}`
                    : '—'
                }
                sourceLabel="自动带出"
              />
            </Form.Item>

            <Form.Item label="分类">
              <InheritedField value={categoryPathText} sourceLabel="自动带出" />
            </Form.Item>

            <Form.Item label="供应商">
              <InheritedField value={currentSnapshot?.supplier_name ?? '—'} sourceLabel="自动带出" />
            </Form.Item>

            <Form.Item label="采购价(CNY)">
              <InheritedField value={formatMoney(currentSnapshot?.purchase_price ?? null)} sourceLabel="自动带出" />
            </Form.Item>

            <Form.Item label="产品状态">
              <InheritedField value={currentSnapshot?.product_status ?? '—'} sourceLabel="自动带出" />
            </Form.Item>
          </FormGrid>
        </FormSectionCard>

        <FormSectionCard title="区域价格">
          <Form.List
            name="regions"
            rules={[
              {
                validator: async (_, value: PriceFormValues['regions']) => {
                  if (!Array.isArray(value) || value.length === 0) {
                    throw new Error('至少保留一条区域价格')
                  }

                  const normalizedCodes = value
                    .map((item) => item?.country_code?.trim().toUpperCase())
                    .filter(Boolean)

                  if (new Set(normalizedCodes).size !== normalizedCodes.length) {
                    throw new Error('同一国家/地区不可重复填写')
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,0,0,0.88)' }}>
                    每行维护一个区域价格
                  </div>
                  <Button
                    htmlType="button"
                    onClick={() =>
                      add({
                        country_code: '',
                        country_name: '',
                        currency: '',
                        sale_price: null,
                        list_price: null,
                        remarks: '',
                      })
                    }
                  >
                    添加区域
                  </Button>
                </div>

                <div
                  style={{
                    border: '1px solid #f0f0f0',
                    borderRadius: 4,
                    overflow: 'hidden',
                    background: '#fff',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      tableLayout: 'fixed',
                    }}
                  >
                    <thead>
                      <tr style={{ background: '#fafafa' }}>
                        <th style={{ width: 56, padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'center', color: 'rgba(0,0,0,0.65)' }}>序号</th>
                        <th style={{ padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'left', color: 'rgba(0,0,0,0.65)' }}>区域编码</th>
                        <th style={{ padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'left', color: 'rgba(0,0,0,0.65)' }}>区域名称</th>
                        <th style={{ padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'left', color: 'rgba(0,0,0,0.65)' }}>币种</th>
                        <th style={{ padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'left', color: 'rgba(0,0,0,0.65)' }}>销售价</th>
                        <th style={{ padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'left', color: 'rgba(0,0,0,0.65)' }}>列表价</th>
                        <th style={{ padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'left', color: 'rgba(0,0,0,0.65)' }}>备注</th>
                        <th style={{ width: 88, padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'center', color: 'rgba(0,0,0,0.65)' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, index) => (
                        <tr key={field.key}>
                          <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>{index + 1}</td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                            <Form.Item
                              name={[field.name, 'country_code']}
                              style={{ marginBottom: 0 }}
                              rules={[{ required: true, message: '请输入区域编码' }]}
                            >
                              <Input placeholder="如 CN / US / GLOBAL" />
                            </Form.Item>
                          </td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                            <Form.Item
                              name={[field.name, 'country_name']}
                              style={{ marginBottom: 0 }}
                              rules={[{ required: true, message: '请输入区域名称' }]}
                            >
                              <Input placeholder="如 中国 / 美国 / 全球" />
                            </Form.Item>
                          </td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                            <Form.Item
                              name={[field.name, 'currency']}
                              style={{ marginBottom: 0 }}
                              rules={[{ required: true, message: '请输入币种' }]}
                            >
                              <Input placeholder="如 CNY / USD" />
                            </Form.Item>
                          </td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                            <Form.Item
                              name={[field.name, 'sale_price']}
                              style={{ marginBottom: 0 }}
                              rules={[{ required: true, message: '请输入销售价' }]}
                            >
                              <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="请输入" />
                            </Form.Item>
                          </td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                            <Form.Item
                              name={[field.name, 'list_price']}
                              style={{ marginBottom: 0 }}
                              rules={[{ required: true, message: '请输入列表价' }]}
                            >
                              <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="请输入" />
                            </Form.Item>
                          </td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                            <Form.Item name={[field.name, 'remarks']} style={{ marginBottom: 0 }}>
                              <Input placeholder="可选" />
                            </Form.Item>
                          </td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
                            <Button
                              htmlType="button"
                              type="link"
                              danger
                              disabled={fields.length === 1}
                              onClick={() => remove(field.name)}
                            >
                              删除
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Form.ErrorList errors={errors} />
              </>
            )}
          </Form.List>
        </FormSectionCard>
      </Form>

      <div style={{ flex: 1 }} />

      <FixedActionBar
        onCancel={() => void leaveCurrentTab()}
        onSave={() => void handleSubmitAction('submit')}
        extraActions={
          <Button
            onClick={() => void handleSubmitAction('draft')}
            disabled={saveMutation.isPending}
          >
            保存草稿
          </Button>
        }
        loading={saveMutation.isPending}
        saveText="提交审批"
      />
    </div>
  )
}
