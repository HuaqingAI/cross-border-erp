import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Cascader, Form, Input, InputNumber, Select, Space, Tooltip, message } from 'antd'
import { useEffect, useMemo } from 'react'
import { useAliveController } from 'react-activation'
import { useNavigate } from 'react-router-dom'
import { categoriesApi } from '../../../../api/categories'
import { spusApi } from '../../../../api/spus'
import { FixedActionBar, FormSectionCard } from '../../../../components/common'
import FormGrid from '../../../../components/form/FormGrid'
import type { DefaultOptionType } from 'antd/es/cascader'
import { buildEnumOptions, useSystemEnumItems } from '../../../../hooks/useSystemEnums'
import { useUIStore } from '../../../../stores/uiStore'
import type { CategoryTreeNode, Spu, SpuMutationPayload } from '../../../../types/product'

interface SpuFormValues {
  code: string
  name: string
  category_path: number[]
  customer_warranty_months: number
  unit: string
  restricted_countries: string[]
  supplier_name: string
  manufacturer_model: string
  purchase_price?: number | null
  purchase_warranty_months?: number | null
  supplier_warranty_notes?: string | null
  invoice_infos: Array<{
    invoice_name: string
    invoice_unit: string
    invoice_model: string
    company_subject: string
    sort_order?: number
  }>
}

const DEFAULT_FORM_VALUES: SpuFormValues = {
  code: '',
  name: '',
  category_path: [],
  customer_warranty_months: 12,
  unit: '',
  restricted_countries: [],
  supplier_name: '',
  manufacturer_model: '',
  purchase_price: null,
  purchase_warranty_months: null,
  supplier_warranty_notes: null,
  invoice_infos: [
    {
      invoice_name: '',
      invoice_unit: '',
      invoice_model: '',
      company_subject: '',
      sort_order: 0,
    },
  ],
}

interface SPUFormPageProps {
  mode: 'create' | 'edit'
  spuId: string | null
}

function toCategoryOptions(nodes: CategoryTreeNode[]): DefaultOptionType[] {
  return nodes.map((node) => ({
    value: node.id,
    label: node.name,
    children: toCategoryOptions(node.children),
  }))
}

function toPayload(values: SpuFormValues): SpuMutationPayload {
  const restrictedCountries = Array.isArray(values.restricted_countries)
    ? values.restricted_countries
    : []
  const invoiceInfos = Array.isArray(values.invoice_infos) ? values.invoice_infos : []

  return {
    code: values.code.trim(),
    name: values.name.trim(),
    level1_category_id: values.category_path[0],
    level2_category_id: values.category_path[1],
    level3_category_id: values.category_path[2],
    customer_warranty_months: values.customer_warranty_months,
    unit: values.unit.trim(),
    restricted_countries: restrictedCountries
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
    supplier_name: values.supplier_name?.trim() ?? '',
    manufacturer_model: values.manufacturer_model.trim(),
    purchase_price: values.purchase_price ?? null,
    purchase_warranty_months: values.purchase_warranty_months ?? null,
    supplier_warranty_notes: values.supplier_warranty_notes?.trim() || null,
    invoice_infos: invoiceInfos.map((item, index) => ({
      invoice_name: item.invoice_name.trim(),
      invoice_unit: item.invoice_unit.trim(),
      invoice_model: item.invoice_model.trim(),
      company_subject: item.company_subject.trim(),
      sort_order: item.sort_order ?? index,
    })),
  }
}

function toFormValues(spu: Spu): SpuFormValues {
  return {
    code: spu.code,
    name: spu.name,
    category_path: [spu.level1_category_id, spu.level2_category_id, spu.level3_category_id],
    customer_warranty_months: spu.customer_warranty_months,
    unit: spu.unit,
    restricted_countries: spu.restricted_countries ?? [],
    supplier_name: spu.supplier_name,
    manufacturer_model: spu.manufacturer_model,
    purchase_price:
      spu.purchase_price === undefined || spu.purchase_price === null
        ? null
        : Number(spu.purchase_price),
    purchase_warranty_months: spu.purchase_warranty_months ?? null,
    supplier_warranty_notes: spu.supplier_warranty_notes ?? null,
    invoice_infos:
      spu.invoice_infos?.map((item) => ({
        invoice_name: item.invoice_name,
        invoice_unit: item.invoice_unit,
        invoice_model: item.invoice_model,
        company_subject: item.company_subject,
        sort_order: item.sort_order,
      })) ?? [
        {
          invoice_name: '',
          invoice_unit: '',
          invoice_model: '',
          company_subject: '',
          sort_order: 0,
        },
      ],
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
  return '保存失败，请稍后重试'
}

function getCurrentPath(mode: 'create' | 'edit', spuId: string | null): string {
  if (mode === 'edit' && spuId) {
    return `/products/spus/${spuId}/edit`
  }

  return '/products/spus/new'
}

export default function SPUFormPage({ mode, spuId }: SPUFormPageProps) {
  const navigate = useNavigate()
  const { drop } = useAliveController()
  const queryClient = useQueryClient()
  const closeTab = useUIStore((state) => state.closeTab)
  const openTab = useUIStore((state) => state.openTab)
  const numericSpuId = useMemo(() => {
    if (!spuId) return null
    const parsed = Number(spuId)
    return Number.isFinite(parsed) ? parsed : null
  }, [spuId])
  const currentPath = getCurrentPath(mode, spuId)
  const isInvalidEditTarget = mode === 'edit' && numericSpuId === null
  const isEditMode = mode === 'edit' && numericSpuId !== null
  const [form] = Form.useForm<SpuFormValues>()
  const categoriesQuery = useQuery({
    queryKey: ['categories-tree'],
    queryFn: categoriesApi.getTree,
  })
  const unitQuery = useSystemEnumItems('unit')
  const countryRegionQuery = useSystemEnumItems('country_region')
  const detailQuery = useQuery({
    queryKey: ['spu-detail', numericSpuId],
    queryFn: () => spusApi.getById(numericSpuId as number),
    enabled: isEditMode,
  })
  const categoryOptions = toCategoryOptions(categoriesQuery.data ?? [])
  const unitOptions = buildEnumOptions(
    unitQuery.data,
    [
      detailQuery.data?.unit ? { value: detailQuery.data.unit } : null,
      ...(detailQuery.data?.invoice_infos ?? []).map((item) => ({
        value: item.invoice_unit,
      })),
    ].filter((item): item is { value: string } => item !== null),
  )
  const countryRegionOptions = buildEnumOptions(
    countryRegionQuery.data,
    (detailQuery.data?.restricted_countries ?? []).map((value) => ({ value })),
  )

  const formInitialValues = useMemo(
    () => (isEditMode && detailQuery.data ? toFormValues(detailQuery.data) : DEFAULT_FORM_VALUES),
    [detailQuery.data, isEditMode],
  )

  useEffect(() => {
    form.setFieldsValue(formInitialValues)
  }, [form, formInitialValues])

  const leaveCurrentTab = async () => {
    openTab({ key: '/products/spus', label: 'SPU管理', closable: true })
    navigate('/products/spus')
    drop(currentPath)
    closeTab(currentPath)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: SpuFormValues) => {
      const payload = toPayload(values)
      if (isEditMode && numericSpuId !== null) {
        const { code: _code, ...updatePayload } = payload
        return spusApi.update(numericSpuId, updatePayload)
      }
      return spusApi.create(payload)
    },
    onSuccess: async (savedSpu) => {
      message.success('保存成功')
      await queryClient.invalidateQueries({ queryKey: ['spus-list'] })
      await queryClient.invalidateQueries({ queryKey: ['spu-supplier-options'] })
      if (savedSpu?.id) {
        queryClient.setQueryData(['spu-detail', savedSpu.id], savedSpu)
      }
      await leaveCurrentTab()
    },
    onError: (error) => {
      window.console.error(error)
      message.error(getErrorMessage(error))
    },
  })

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
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(0,0,0,0.88)' }}>SPU 标识无效</div>
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>当前编辑地址缺少有效的 SPU ID，请返回列表后重新进入。</div>
          <Button type="primary" onClick={() => void leaveCurrentTab()}>
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  if (isEditMode && detailQuery.isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <div
          style={{
            minHeight: 320,
            background: '#fff',
            borderRadius: 4,
            border: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          正在加载 SPU 数据...
        </div>
      </div>
    )
  }

  if (isEditMode && (detailQuery.isError || !detailQuery.data)) {
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
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(0,0,0,0.88)' }}>SPU 数据加载失败</div>
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>请稍后重试，或返回列表后重新打开编辑页。</div>
          <Space>
            <Button onClick={() => void detailQuery.refetch()}>重试</Button>
            <Button type="primary" onClick={() => void leaveCurrentTab()}>
              返回列表
            </Button>
          </Space>
        </div>
      </div>
    )
  }

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
      <Form
        key={
          isEditMode
            ? `edit-${numericSpuId}-${detailQuery.data?.updated_at ?? detailQuery.data?.created_at ?? 'ready'}`
            : 'new'
        }
        form={form}
        layout="vertical"
        onFinish={(values) => saveMutation.mutate(values)}
        initialValues={formInitialValues}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <FormSectionCard title="基础信息">
          <FormGrid rowGap={16} columnGap={24} itemStyle={{ marginBottom: 0 }}>
            <Form.Item label="SPU编码" name="code" rules={[{ required: true, message: '请输入SPU编码' }]}>
              <Input placeholder="请输入SPU编码" disabled={isEditMode} />
            </Form.Item>
            <Form.Item label="SPU名称" name="name" rules={[{ required: true, message: '请输入SPU名称' }]}>
              <Input placeholder="请输入SPU名称" />
            </Form.Item>
            <Form.Item label="分类" name="category_path" rules={[{ required: true, message: '请选择三级分类' }]}>
              <Cascader options={categoryOptions} placeholder="请选择三级分类" />
            </Form.Item>
            <Form.Item
              label="客户质保期(月)"
              name="customer_warranty_months"
              rules={[{ required: true, message: '请输入客户质保期' }]}
            >
              <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入客户质保期" />
            </Form.Item>
            <Form.Item label="单位" name="unit" rules={[{ required: true, message: '请选择单位' }]}>
              <Select
                showSearch
                placeholder="请选择单位"
                options={unitOptions}
                loading={unitQuery.isLoading}
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item label="禁止经营国家" name="restricted_countries">
              <Select
                mode="multiple"
                allowClear
                showSearch
                placeholder="请选择禁止经营国家"
                options={countryRegionOptions}
                loading={countryRegionQuery.isLoading}
                optionFilterProp="label"
              />
            </Form.Item>
          </FormGrid>
        </FormSectionCard>

        <FormSectionCard title="采购信息">
          <FormGrid rowGap={16} columnGap={24} itemStyle={{ marginBottom: 0 }}>
            <Form.Item label="供应商" name="supplier_name" rules={[{ required: true, message: '请输入供应商' }]}>
              <Input placeholder="请输入供应商" />
            </Form.Item>
            <Form.Item
              label="厂家型号"
              name="manufacturer_model"
              rules={[{ required: true, message: '请输入厂家型号' }]}
            >
              <Input placeholder="请输入厂家型号" />
            </Form.Item>
            <Form.Item label="采购价(CNY)" name="purchase_price">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入采购价" />
            </Form.Item>
            <Form.Item label="采购质保期(月)" name="purchase_warranty_months">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入采购质保期" />
            </Form.Item>
            <Form.Item label="供应商质保说明" name="supplier_warranty_notes" style={{ gridColumn: '1 / -1' }}>
              <Input.TextArea rows={4} placeholder="请输入供应商质保说明" />
            </Form.Item>
          </FormGrid>
        </FormSectionCard>

        <FormSectionCard title="开票信息">
          <Form.List
            name="invoice_infos"
            rules={[
              {
                validator: async (_, value) => {
                  if (Array.isArray(value) && value.length > 0) {
                    return
                  }

                  throw new Error('至少保留一条开票信息')
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <Button
                      htmlType="button"
                      onClick={() =>
                        add({
                          invoice_name: '',
                          invoice_unit: '',
                          invoice_model: '',
                          company_subject: '',
                        })
                      }
                    >
                      添加开票信息
                    </Button>
                    <Tooltip title="创建后不可修改">
                      <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>编辑态下 SPU 编码将禁用</span>
                    </Tooltip>
                  </Space>
                </div>

                <div
                  style={{
                    border: '1px solid #f0f0f0',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr 96px',
                      gap: 0,
                      background: '#fafafa',
                      borderBottom: '1px solid #f0f0f0',
                      fontWeight: 600,
                      color: 'rgba(0,0,0,0.88)',
                    }}
                  >
                    <div style={{ padding: '14px 16px' }}>开票品名</div>
                    <div style={{ padding: '14px 16px' }}>开票单位</div>
                    <div style={{ padding: '14px 16px' }}>开票型号</div>
                    <div style={{ padding: '14px 16px' }}>公司主体</div>
                    <div style={{ padding: '14px 16px' }}>操作</div>
                  </div>

                  {fields.map((field, index) => (
                    <div
                      key={field.key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr 96px',
                        gap: 0,
                        borderBottom: index === fields.length - 1 ? 'none' : '1px solid #f0f0f0',
                        alignItems: 'start',
                      }}
                    >
                      <div style={{ padding: '14px 16px 8px' }}>
                        <Form.Item
                          name={[field.name, 'invoice_name']}
                          style={{ marginBottom: 0 }}
                          rules={[{ required: true, message: '请输入开票品名' }]}
                        >
                          <Input placeholder="请输入开票品名" />
                        </Form.Item>
                      </div>
                      <div style={{ padding: '14px 16px 8px' }}>
                        <Form.Item
                          name={[field.name, 'invoice_unit']}
                          style={{ marginBottom: 0 }}
                          rules={[{ required: true, message: '请输入开票单位' }]}
                        >
                          <Select
                            showSearch
                            placeholder="请选择开票单位"
                            options={unitOptions}
                            loading={unitQuery.isLoading}
                            optionFilterProp="label"
                          />
                        </Form.Item>
                      </div>
                      <div style={{ padding: '14px 16px 8px' }}>
                        <Form.Item
                          name={[field.name, 'invoice_model']}
                          style={{ marginBottom: 0 }}
                          rules={[{ required: true, message: '请输入开票型号' }]}
                        >
                          <Input placeholder="请输入开票型号" />
                        </Form.Item>
                      </div>
                      <div style={{ padding: '14px 16px 8px' }}>
                        <Form.Item
                          name={[field.name, 'company_subject']}
                          style={{ marginBottom: 0 }}
                          rules={[{ required: true, message: '请输入公司主体' }]}
                        >
                          <Input placeholder="请输入公司主体" />
                        </Form.Item>
                      </div>
                      <div style={{ padding: '14px 16px 8px' }}>
                        <Button danger type="link" disabled={fields.length === 1} onClick={() => remove(field.name)}>
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Form.ErrorList errors={errors} />
              </>
            )}
          </Form.List>
        </FormSectionCard>
      </Form>
      <div
        style={{
          flex: 1,
        }}
      />
      <FixedActionBar
        onCancel={() => void leaveCurrentTab()}
        onSave={() => form.submit()}
        loading={saveMutation.isPending}
      />
    </div>
  )
}
