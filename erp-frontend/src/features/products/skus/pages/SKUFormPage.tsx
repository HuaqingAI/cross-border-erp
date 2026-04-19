import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Form,
  Image,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tooltip,
  message,
} from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useAliveController } from 'react-activation'
import { useNavigate } from 'react-router-dom'
import { categoriesApi } from '../../../../api/categories'
import { skusApi } from '../../../../api/skus'
import { spusApi } from '../../../../api/spus'
import { FixedActionBar, FormSectionCard, InheritedField } from '../../../../components/common'
import FormGrid from '../../../../components/form/FormGrid'
import { usePermission } from '../../../../hooks/usePermission'
import { useUIStore } from '../../../../stores/uiStore'
import type {
  CategoryTreeNode,
  Sku,
  SkuCustomsInfoPayload,
  SkuImage,
  SkuMutationPayload,
  SkuProductStatus,
  SkuProductType,
  Spu,
  SpuListItem,
} from '../../../../types/product'
import { uploadFile } from '../../../../utils/upload'

export interface SkuFormValues {
  spu_id?: number
  code: string
  name_zh: string
  name_en: string
  product_model: string
  product_type?: SkuProductType
  core_params: string
  product_status?: SkuProductStatus
  electrical_params?: string | null
  principle: string
  usage: string
  material?: string | null
  unit: string
  has_plug: boolean
  is_special: boolean
  special_notes?: string | null
  package_type?: string | null
  package_quantity?: number | null
  package_details: Array<{
    net_weight_kg?: number | null
    gross_weight_kg?: number | null
    length_cm?: number | null
    width_cm?: number | null
    height_cm?: number | null
    volume_cbm?: number | null
    sort_order?: number
  }>
  customs_hscode?: string | null
  customs_supervision_condition?: string | null
  customs_declaration_elements?: string | null
  customs_refund_tax_rate?: number | null
  customs_info_ready: boolean
}

const PRODUCT_TYPE_OPTIONS: Array<{ label: SkuProductType; value: SkuProductType }> = [
  { label: '主品', value: '主品' },
  { label: '配件', value: '配件' },
  { label: '耗材', value: '耗材' },
]

const PRODUCT_STATUS_OPTIONS: Array<{ label: SkuProductStatus; value: SkuProductStatus }> = [
  { label: '上架', value: '上架' },
  { label: '下架可售', value: '下架可售' },
  { label: '下架不可售', value: '下架不可售' },
  { label: '临拓', value: '临拓' },
]

const PACKAGE_TYPE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '纸箱', value: '纸箱' },
  { label: '木箱', value: '木箱' },
  { label: '其他', value: '其他' },
]

const DEFAULT_FORM_VALUES: SkuFormValues = {
  spu_id: undefined,
  code: '',
  name_zh: '',
  name_en: '',
  product_model: '',
  product_type: undefined,
  core_params: '',
  product_status: '上架',
  electrical_params: null,
  principle: '',
  usage: '',
  material: null,
  unit: '',
  has_plug: false,
  is_special: false,
  special_notes: null,
  package_type: null,
  package_quantity: null,
  package_details: [],
  customs_hscode: null,
  customs_supervision_condition: null,
  customs_declaration_elements: null,
  customs_refund_tax_rate: null,
  customs_info_ready: false,
}

interface PendingImageFile {
  key: string
  file: File
}

class PartialSaveError extends Error {
  sku: Sku
  stage: 'customs' | 'images'

  constructor(messageText: string, sku: Sku, stage: 'customs' | 'images') {
    super(messageText)
    this.name = 'PartialSaveError'
    this.sku = sku
    this.stage = stage
  }
}

interface SKUFormPageProps {
  mode: 'create' | 'edit'
  skuId: string | null
}

function findCategoryNameById(nodes: CategoryTreeNode[], id: number): string | null {
  for (const node of nodes) {
    if (node.id === id) return node.name
    const childName = findCategoryNameById(node.children, id)
    if (childName) return childName
  }

  return null
}

function formatInheritedCategoryPath(
  categoryTree: CategoryTreeNode[],
  ids: Array<number | undefined>,
): string {
  const names = ids
    .map((id) => (typeof id === 'number' ? findCategoryNameById(categoryTree, id) : null))
    .filter((value): value is string => Boolean(value))

  return names.length > 0 ? names.join(' / ') : '—'
}

function buildSpuOptionLabel(spu: Pick<SpuListItem, 'code' | 'name'>): string {
  return `${spu.code} | ${spu.name}`
}

function getCurrentPath(mode: 'create' | 'edit', skuId: string | null): string {
  if (mode === 'edit' && skuId) {
    return `/products/skus/${skuId}/edit`
  }

  return '/products/skus/new'
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

  return '保存失败，请稍后重试'
}

export function toSkuMutationPayload(values: SkuFormValues): SkuMutationPayload {
  const packageDetails = Array.isArray(values.package_details) ? values.package_details : []

  return {
    spu_id: values.spu_id as number,
    code: values.code.trim(),
    name_zh: values.name_zh.trim(),
    name_en: values.name_en.trim(),
    product_model: values.product_model.trim(),
    product_type: values.product_type as SkuProductType,
    core_params: values.core_params.trim(),
    product_status: values.product_status,
    electrical_params: values.electrical_params?.trim() || null,
    principle: values.principle.trim(),
    usage: values.usage.trim(),
    material: values.material?.trim() || null,
    unit: values.unit.trim(),
    has_plug: values.has_plug,
    is_special: values.is_special,
    special_notes: values.special_notes?.trim() || null,
    package_type: values.package_type?.trim() || null,
    package_quantity: values.package_quantity ?? null,
    package_details: packageDetails.map((detail, index) => ({
      net_weight_kg: detail.net_weight_kg ?? null,
      gross_weight_kg: detail.gross_weight_kg ?? null,
      length_cm: detail.length_cm ?? null,
      width_cm: detail.width_cm ?? null,
      height_cm: detail.height_cm ?? null,
      volume_cbm: calculatePackageVolume(detail),
      sort_order: detail.sort_order ?? index,
    })),
  }
}

export function toSkuCustomsPayload(values: SkuFormValues): SkuCustomsInfoPayload {
  return {
    customs_hscode: values.customs_hscode?.trim() || null,
    customs_supervision_condition: values.customs_supervision_condition?.trim() || null,
    customs_declaration_elements: values.customs_declaration_elements?.trim() || null,
    customs_refund_tax_rate: values.customs_refund_tax_rate ?? null,
    customs_info_ready: values.customs_info_ready,
  }
}

export function toSkuFormValues(sku: Sku): SkuFormValues {
  return {
    spu_id: sku.spu_id,
    code: sku.code,
    name_zh: sku.name_zh,
    name_en: sku.name_en,
    product_model: sku.product_model,
    product_type: sku.product_type,
    core_params: sku.core_params,
    product_status: sku.product_status,
    electrical_params: sku.electrical_params ?? null,
    principle: sku.principle,
    usage: sku.usage,
    material: sku.material ?? null,
    unit: sku.unit,
    has_plug: sku.has_plug,
    is_special: sku.is_special,
    special_notes: sku.special_notes ?? null,
    package_type: sku.package_type ?? null,
    package_quantity: sku.package_quantity ?? null,
    package_details:
      sku.package_details?.map((detail) => ({
        net_weight_kg:
          detail.net_weight_kg === undefined || detail.net_weight_kg === null
            ? null
            : Number(detail.net_weight_kg),
        gross_weight_kg:
          detail.gross_weight_kg === undefined || detail.gross_weight_kg === null
            ? null
            : Number(detail.gross_weight_kg),
        length_cm:
          detail.length_cm === undefined || detail.length_cm === null ? null : Number(detail.length_cm),
        width_cm:
          detail.width_cm === undefined || detail.width_cm === null ? null : Number(detail.width_cm),
        height_cm:
          detail.height_cm === undefined || detail.height_cm === null ? null : Number(detail.height_cm),
        volume_cbm:
          detail.volume_cbm === undefined || detail.volume_cbm === null ? null : Number(detail.volume_cbm),
        sort_order: detail.sort_order,
      })) ?? [],
    customs_hscode: sku.customs_hscode ?? null,
    customs_supervision_condition: sku.customs_supervision_condition ?? null,
    customs_declaration_elements: sku.customs_declaration_elements ?? null,
    customs_refund_tax_rate:
      sku.customs_refund_tax_rate === undefined || sku.customs_refund_tax_rate === null
        ? null
        : Number(sku.customs_refund_tax_rate),
    customs_info_ready: sku.customs_info_ready,
  }
}

function mergeSpuOptions(
  queriedItems: SpuListItem[],
  currentSku: Sku | undefined,
): Array<{ label: string; value: number }> {
  const options = new Map<number, string>()

  for (const item of queriedItems) {
    options.set(item.id, buildSpuOptionLabel(item))
  }

  if (currentSku && !options.has(currentSku.spu_id)) {
    options.set(
      currentSku.spu_id,
      `${currentSku.spu_code} | ${currentSku.spu_name}`,
    )
  }

  return Array.from(options.entries()).map(([value, label]) => ({ value, label }))
}

export function calculatePackageVolume(detail: {
  length_cm?: number | null
  width_cm?: number | null
  height_cm?: number | null
}): number | null {
  const length = detail.length_cm ?? null
  const width = detail.width_cm ?? null
  const height = detail.height_cm ?? null

  if (
    length === null ||
    width === null ||
    height === null ||
    !Number.isFinite(length) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null
  }

  return Number(((length * width * height) / 1_000_000).toFixed(6))
}

export async function isSkuCodeTaken(code: string): Promise<boolean> {
  const trimmed = code.trim()
  if (!trimmed) {
    return false
  }

  const pageSize = 100
  let page = 1

  while (true) {
    const result = await skusApi.list({
      page,
      page_size: pageSize,
      keyword: trimmed,
    })

    if (result.items.some((item) => item.code === trimmed)) {
      return true
    }

    if (page * pageSize >= result.total || result.items.length === 0) {
      return false
    }

    page += 1
  }
}

export default function SKUFormPage({ mode, skuId }: SKUFormPageProps) {
  const permission = usePermission()
  const navigate = useNavigate()
  const { drop } = useAliveController()
  const queryClient = useQueryClient()
  const closeTab = useUIStore((state) => state.closeTab)
  const openTab = useUIStore((state) => state.openTab)
  const [form] = Form.useForm<SkuFormValues>()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [spuSearchKeyword, setSpuSearchKeyword] = useState('')
  const [spuSelectOpen, setSpuSelectOpen] = useState(false)
  const [existingImages, setExistingImages] = useState<SkuImage[]>([])
  const [pendingImages, setPendingImages] = useState<PendingImageFile[]>([])
  const [removedImageIds, setRemovedImageIds] = useState<number[]>([])

  const numericSkuId = useMemo(() => {
    if (!skuId) return null
    const parsed = Number(skuId)
    return Number.isFinite(parsed) ? parsed : null
  }, [skuId])

  const currentPath = getCurrentPath(mode, skuId)
  const isEditMode = mode === 'edit' && numericSkuId !== null
  const isInvalidEditTarget = mode === 'edit' && numericSkuId === null
  const canEditMainFields = permission.canCreateProduct
  const canEditCustomsFields = permission.canEditCustomsInfo
  const canAccessForm = mode === 'create' ? canEditMainFields : canEditMainFields || canEditCustomsFields
  const canSave = canEditMainFields || canEditCustomsFields

  const categoriesQuery = useQuery({
    queryKey: ['categories-tree'],
    queryFn: categoriesApi.getTree,
  })

  const detailQuery = useQuery({
    queryKey: ['sku-detail', numericSkuId],
    queryFn: () => skusApi.getById(numericSkuId as number),
    enabled: isEditMode,
  })

  const spuOptionsQuery = useQuery({
    queryKey: ['spu-options', spuSearchKeyword],
    queryFn: () =>
      spusApi.list({
        page: 1,
        page_size: 20,
        keyword: spuSearchKeyword.trim() || undefined,
      }),
    enabled: canEditMainFields && spuSelectOpen,
  })

  const selectedSpuId = Form.useWatch('spu_id', form)
  const packageDetailsValue = Form.useWatch('package_details', form) ?? []

  const selectedSpuQuery = useQuery({
    queryKey: ['spu-detail-for-sku-form', selectedSpuId],
    queryFn: () => spusApi.getById(selectedSpuId as number),
    enabled: typeof selectedSpuId === 'number',
  })

  const formInitialValues = useMemo(
    () => (isEditMode && detailQuery.data ? toSkuFormValues(detailQuery.data) : DEFAULT_FORM_VALUES),
    [detailQuery.data, isEditMode],
  )

  useEffect(() => {
    form.setFieldsValue(formInitialValues)
  }, [form, formInitialValues])

  useEffect(() => {
    if (isEditMode && detailQuery.data) {
      setExistingImages(detailQuery.data.images ?? [])
      setPendingImages([])
      setRemovedImageIds([])
      return
    }

    if (!isEditMode) {
      setExistingImages([])
      setPendingImages([])
      setRemovedImageIds([])
    }
  }, [detailQuery.data, isEditMode])

  const inheritedSpu = useMemo(() => {
    if (selectedSpuQuery.data) {
      return selectedSpuQuery.data
    }

    if (detailQuery.data && detailQuery.data.spu_id === selectedSpuId) {
      return {
        id: detailQuery.data.spu_id,
        code: detailQuery.data.spu_code,
        name: detailQuery.data.spu_name,
        level1_category_id: detailQuery.data.level1_category_id,
        level2_category_id: detailQuery.data.level2_category_id,
        level3_category_id: detailQuery.data.level3_category_id,
        supplier_name: detailQuery.data.supplier_name,
        customer_warranty_months: detailQuery.data.customer_warranty_months,
        restricted_countries: detailQuery.data.restricted_countries,
      } as Spu
    }

    return null
  }, [detailQuery.data, selectedSpuId, selectedSpuQuery.data])

  const categoryTree = categoriesQuery.data ?? []
  const inheritedCategoryPath = formatInheritedCategoryPath(categoryTree, [
    inheritedSpu?.level1_category_id,
    inheritedSpu?.level2_category_id,
    inheritedSpu?.level3_category_id,
  ])

  const spuOptions = mergeSpuOptions(spuOptionsQuery.data?.items ?? [], detailQuery.data)
  const imageAltText = Form.useWatch('name_zh', form) || 'SKU图片'

  const leaveCurrentTab = async () => {
    openTab({ key: '/products/skus', label: 'SKU管理', closable: true })
    navigate('/products/skus')
    drop(currentPath)
    closeTab(currentPath)
  }

  const handlePickImages = () => {
    fileInputRef.current?.click()
  }

  const handleImagesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    setPendingImages((previous) => {
      const next = [...previous]
      for (const file of files) {
        const key = `${file.name}-${file.size}-${file.lastModified}`
        if (!next.some((item) => item.key === key)) {
          next.push({ key, file })
        }
      }
      return next
    })

    event.target.value = ''
  }

  const removePendingImage = (key: string) => {
    setPendingImages((previous) => previous.filter((item) => item.key !== key))
  }

  const removeExistingImage = (imageId: number) => {
    setRemovedImageIds((previous) => (previous.includes(imageId) ? previous : [...previous, imageId]))
    setExistingImages((previous) => previous.filter((item) => item.id !== imageId))
  }

  const syncImages = async (sku: Sku): Promise<Sku> => {
    let latestSku = sku

    for (const imageId of removedImageIds) {
      latestSku = await skusApi.deleteImage(latestSku.id, imageId)
    }

    let nextSortOrder = latestSku.images.length
    for (const image of pendingImages) {
      const uploaded = await uploadFile(image.file)
      latestSku = await skusApi.addImage(latestSku.id, {
        object_key: uploaded.fileKey,
        file_url: uploaded.url,
        filename: uploaded.filename,
        content_type: image.file.type || 'application/octet-stream',
        sort_order: nextSortOrder,
      })
      nextSortOrder += 1
    }

    return latestSku
  }

  const validateUniqueCode = async (_: unknown, value?: string) => {
    const trimmed = value?.trim()
    if (!trimmed || !canEditMainFields || isEditMode) {
      return
    }

    try {
      if (await isSkuCodeTaken(trimmed)) {
        throw new Error('SKU编码已存在，请更换')
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'SKU编码已存在，请更换') {
        throw error
      }

      window.console.error(error)
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (values: SkuFormValues) => {
      let savedSku: Sku

      if (canEditMainFields) {
        const payload = toSkuMutationPayload(values)
        if (isEditMode && numericSkuId !== null) {
          const { code: _code, ...updatePayload } = payload
          savedSku = await skusApi.update(numericSkuId, updatePayload)
        } else {
          savedSku = await skusApi.create(payload)
        }
      } else if (detailQuery.data) {
        savedSku = detailQuery.data
      } else {
        throw new Error('当前角色无权保存 SKU 基础信息')
      }

      if (canEditCustomsFields) {
        try {
          savedSku = await skusApi.updateCustomsInfo(savedSku.id, toSkuCustomsPayload(values))
        } catch (error) {
          throw new PartialSaveError(
            `SKU基础信息已保存，但报关信息保存失败：${getErrorMessage(error)}`,
            savedSku,
            'customs',
          )
        }
      }

      if (canEditMainFields && (pendingImages.length > 0 || removedImageIds.length > 0)) {
        try {
          savedSku = await syncImages(savedSku)
        } catch (error) {
          const latestSku = await skusApi.getById(savedSku.id).catch(() => savedSku)
          throw new PartialSaveError(
            `SKU基础信息已保存，但产品图片处理失败：${getErrorMessage(error)}`,
            latestSku,
            'images',
          )
        }
      }

      return savedSku
    },
    onSuccess: async (sku) => {
      message.success('保存成功')
      await queryClient.invalidateQueries({ queryKey: ['skus-list'] })
      if (sku?.id) {
        queryClient.setQueryData(['sku-detail', sku.id], sku)
      }
      await leaveCurrentTab()
    },
    onError: (error) => {
      window.console.error(error)
      if (error instanceof PartialSaveError) {
        if (error.stage !== 'images') {
          queryClient.setQueryData(['sku-detail', error.sku.id], error.sku)
        } else if (isEditMode) {
          setExistingImages(error.sku.images ?? [])
        }
        void queryClient.invalidateQueries({ queryKey: ['skus-list'] })

        if (!isEditMode && canEditMainFields) {
          const recoveryPath = `/products/skus/${error.sku.id}/edit`
          openTab({ key: recoveryPath, label: '编辑SKU', closable: true })
          navigate(recoveryPath)
          drop(currentPath)
          closeTab(currentPath)
        }
      }
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
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(0,0,0,0.88)' }}>SKU 标识无效</div>
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>当前编辑地址缺少有效的 SKU ID，请返回列表后重新进入。</div>
          <Button type="primary" onClick={() => void leaveCurrentTab()}>
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  if (!canAccessForm) {
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
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(0,0,0,0.88)' }}>当前角色无权访问此页面</div>
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>请返回 SKU 列表后通过有权限的操作入口重新进入。</div>
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
          正在加载 SKU 数据...
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
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(0,0,0,0.88)' }}>SKU 数据加载失败</div>
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
        key={isEditMode ? `edit-${numericSkuId}-${detailQuery.data?.updated_at ?? 'ready'}` : 'new'}
        form={form}
        layout="vertical"
        initialValues={formInitialValues}
        onFinish={(values) => saveMutation.mutate(values)}
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
              label="所属 SPU"
              name="spu_id"
              rules={[{ required: true, message: '请选择所属 SPU' }]}
            >
              <Select
                showSearch
                allowClear={false}
                disabled={!canEditMainFields}
                filterOption={false}
                options={spuOptions}
                placeholder="请输入关键词搜索 SPU"
                onSearch={setSpuSearchKeyword}
                onOpenChange={setSpuSelectOpen}
                notFoundContent={spuOptionsQuery.isLoading ? '正在搜索 SPU...' : '暂无匹配 SPU'}
              />
            </Form.Item>

            <Form.Item
              label="SKU编码"
              name="code"
              rules={[
                { required: true, message: '请输入 SKU 编码' },
                { validator: validateUniqueCode },
              ]}
              validateTrigger="onBlur"
            >
              <Input
                placeholder="请输入 SKU 编码"
                disabled={!canEditMainFields || isEditMode}
                suffix={
                  isEditMode ? (
                    <Tooltip title="创建后不可修改">
                      <span style={{ color: 'rgba(0,0,0,0.35)' }}>只读</span>
                    </Tooltip>
                  ) : null
                }
              />
            </Form.Item>

            <Form.Item label="SKU中文名称" name="name_zh" rules={[{ required: true, message: '请输入 SKU 中文名称' }]}>
              <Input placeholder="请输入 SKU 中文名称" disabled={!canEditMainFields} />
            </Form.Item>

            <Form.Item label="SKU英文名称" name="name_en" rules={[{ required: true, message: '请输入 SKU 英文名称' }]}>
              <Input placeholder="请输入 SKU 英文名称" disabled={!canEditMainFields} />
            </Form.Item>

            <Form.Item label="产品型号" name="product_model" rules={[{ required: true, message: '请输入产品型号' }]}>
              <Input placeholder="请输入产品型号" disabled={!canEditMainFields} />
            </Form.Item>

            <Form.Item label="分类">
              <InheritedField value={inheritedCategoryPath} />
            </Form.Item>

            <Form.Item label="供应商">
              <InheritedField value={inheritedSpu?.supplier_name ?? '—'} />
            </Form.Item>

            <Form.Item label="禁止经营国家">
              <InheritedField value={(inheritedSpu?.restricted_countries ?? []).join('、') || '—'} />
            </Form.Item>

            <Form.Item label="客户质保期(月)">
              <InheritedField value={inheritedSpu?.customer_warranty_months ?? '—'} />
            </Form.Item>
          </FormGrid>
        </FormSectionCard>

        <FormSectionCard title="产品属性">
          <FormGrid rowGap={16} columnGap={24} itemStyle={{ marginBottom: 0 }}>
            <Form.Item label="产品类型" name="product_type" rules={[{ required: true, message: '请选择产品类型' }]}>
              <Select
                allowClear
                options={PRODUCT_TYPE_OPTIONS}
                placeholder="请选择产品类型"
                disabled={!canEditMainFields}
              />
            </Form.Item>

            <Form.Item label="产品状态" name="product_status" rules={[{ required: true, message: '请选择产品状态' }]}>
              <Select
                allowClear
                options={PRODUCT_STATUS_OPTIONS}
                placeholder="请选择产品状态"
                disabled={!canEditMainFields}
              />
            </Form.Item>

            <Form.Item label="单位" name="unit" rules={[{ required: true, message: '请输入单位' }]}>
              <Input placeholder="请输入单位" disabled={!canEditMainFields} />
            </Form.Item>

            <Form.Item label="电气参数" name="electrical_params">
              <Input placeholder="请输入电气参数" disabled={!canEditMainFields} />
            </Form.Item>

            <Form.Item label="材质" name="material">
              <Input placeholder="请输入材质" disabled={!canEditMainFields} />
            </Form.Item>

            <Form.Item label="核心参数" name="core_params" rules={[{ required: true, message: '请输入核心参数' }]} style={{ gridColumn: '1 / -1' }}>
              <Input.TextArea rows={3} placeholder="请输入核心参数" disabled={!canEditMainFields} />
            </Form.Item>

            <Form.Item label="产品原理" name="principle" rules={[{ required: true, message: '请输入产品原理' }]} style={{ gridColumn: '1 / -1' }}>
              <Input.TextArea rows={3} placeholder="请输入产品原理" disabled={!canEditMainFields} />
            </Form.Item>

            <Form.Item label="用途" name="usage" rules={[{ required: true, message: '请输入用途' }]} style={{ gridColumn: '1 / -1' }}>
              <Input.TextArea rows={3} placeholder="请输入用途" disabled={!canEditMainFields} />
            </Form.Item>
          </FormGrid>
        </FormSectionCard>

        <FormSectionCard title="特殊属性">
          <FormGrid rowGap={16} columnGap={24} itemStyle={{ marginBottom: 0 }}>
            <Form.Item label="是否带插头" name="has_plug" valuePropName="checked">
              <Switch disabled={!canEditMainFields} />
            </Form.Item>

            <Form.Item label="是否特殊产品" name="is_special" valuePropName="checked">
              <Switch disabled={!canEditMainFields} />
            </Form.Item>

            <div />

            <Form.Item label="特殊说明" name="special_notes" style={{ gridColumn: '1 / -1' }}>
              <Input.TextArea rows={3} placeholder="请输入特殊说明" disabled={!canEditMainFields} />
            </Form.Item>
          </FormGrid>
        </FormSectionCard>

        <FormSectionCard title="包装信息 + 包装明细">
          <FormGrid rowGap={16} columnGap={24} itemStyle={{ marginBottom: 0 }} style={{ marginBottom: 16 }}>
            <Form.Item label="包装类型" name="package_type">
              <Select
                allowClear
                options={PACKAGE_TYPE_OPTIONS}
                placeholder="请选择包装类型"
                disabled={!canEditMainFields}
              />
            </Form.Item>

            <Form.Item label="包装数量" name="package_quantity">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入包装数量" disabled={!canEditMainFields} />
            </Form.Item>

            <div />
          </FormGrid>

          <Form.List name="package_details">
            {(fields, { add, remove }) => (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,0,0,0.88)' }}>包装明细</div>
                  {canEditMainFields ? (
                    <Button
                      htmlType="button"
                      onClick={() =>
                        add({
                          net_weight_kg: null,
                          gross_weight_kg: null,
                          length_cm: null,
                          width_cm: null,
                          height_cm: null,
                        })
                      }
                    >
                      添加包装明细
                    </Button>
                  ) : null}
                </div>

                {fields.length === 0 ? (
                  <div
                    style={{
                      border: '1px dashed #d9d9d9',
                      borderRadius: 4,
                      padding: 16,
                      color: 'rgba(0,0,0,0.45)',
                      textAlign: 'center',
                    }}
                  >
                    暂无包装明细
                  </div>
                ) : (
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
                          <th style={{ padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'left', color: 'rgba(0,0,0,0.65)' }}>净重(KG)</th>
                          <th style={{ padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'left', color: 'rgba(0,0,0,0.65)' }}>毛重(KG)</th>
                          <th style={{ padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'left', color: 'rgba(0,0,0,0.65)' }}>长(CM)</th>
                          <th style={{ padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'left', color: 'rgba(0,0,0,0.65)' }}>宽(CM)</th>
                          <th style={{ padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'left', color: 'rgba(0,0,0,0.65)' }}>高(CM)</th>
                          <th style={{ padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'left', color: 'rgba(0,0,0,0.65)' }}>体积(CBM)</th>
                          <th style={{ width: 88, padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'center', color: 'rgba(0,0,0,0.65)' }}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((field, index) => {
                          const currentDetail = packageDetailsValue[field.name] ?? {}
                          const volume = calculatePackageVolume(currentDetail)

                          return (
                            <tr key={field.key}>
                              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>{index + 1}</td>
                              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                                <Form.Item name={[field.name, 'net_weight_kg']} style={{ marginBottom: 0 }}>
                                  <InputNumber min={0} style={{ width: '100%' }} disabled={!canEditMainFields} placeholder="请输入数字" />
                                </Form.Item>
                              </td>
                              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                                <Form.Item name={[field.name, 'gross_weight_kg']} style={{ marginBottom: 0 }}>
                                  <InputNumber min={0} style={{ width: '100%' }} disabled={!canEditMainFields} placeholder="请输入数字" />
                                </Form.Item>
                              </td>
                              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                                <Form.Item name={[field.name, 'length_cm']} style={{ marginBottom: 0 }}>
                                  <InputNumber min={0} style={{ width: '100%' }} disabled={!canEditMainFields} placeholder="请输入数字" />
                                </Form.Item>
                              </td>
                              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                                <Form.Item name={[field.name, 'width_cm']} style={{ marginBottom: 0 }}>
                                  <InputNumber min={0} style={{ width: '100%' }} disabled={!canEditMainFields} placeholder="请输入数字" />
                                </Form.Item>
                              </td>
                              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                                <Form.Item name={[field.name, 'height_cm']} style={{ marginBottom: 0 }}>
                                  <InputNumber min={0} style={{ width: '100%' }} disabled={!canEditMainFields} placeholder="请输入数字" />
                                </Form.Item>
                              </td>
                              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                                <Input
                                  value={volume === null ? '' : volume.toFixed(6)}
                                  readOnly
                                  disabled
                                  placeholder="系统自动计算"
                                />
                              </td>
                              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
                                {canEditMainFields ? (
                                  <Button htmlType="button" type="link" danger onClick={() => remove(field.name)}>
                                    删除
                                  </Button>
                                ) : null}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </Form.List>
        </FormSectionCard>

        <FormSectionCard title="报关信息">
          {canEditCustomsFields ? (
            <Alert
              type="info"
              showIcon
              message="当前角色可维护报关信息，保存时将调用商务部专属报关接口。"
              style={{ marginBottom: 16 }}
            />
          ) : (
            <Alert
              type="warning"
              showIcon
              message="报关信息由商务部维护"
              description="当前角色仅可查看，不可编辑报关字段。"
              style={{ marginBottom: 16 }}
            />
          )}

          <FormGrid rowGap={16} columnGap={24} itemStyle={{ marginBottom: 0 }}>
            <Form.Item label="HSCODE" name="customs_hscode">
              <Input placeholder="请输入 HSCODE" disabled={!canEditCustomsFields} />
            </Form.Item>

            <Form.Item label="监管条件" name="customs_supervision_condition">
              <Input placeholder="请输入监管条件" disabled={!canEditCustomsFields} />
            </Form.Item>

            <Form.Item label="退税税点(%)" name="customs_refund_tax_rate">
              <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="请输入退税税点" disabled={!canEditCustomsFields} />
            </Form.Item>

            <Form.Item label="是否已维护" name="customs_info_ready" valuePropName="checked">
              <Switch disabled={!canEditCustomsFields} />
            </Form.Item>

            <Form.Item label="申报要素" name="customs_declaration_elements" style={{ gridColumn: '1 / -1' }}>
              <Input.TextArea rows={4} placeholder="请输入申报要素" disabled={!canEditCustomsFields} />
            </Form.Item>
          </FormGrid>
        </FormSectionCard>

        <FormSectionCard title="产品图片">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImagesSelected}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ color: 'rgba(0,0,0,0.65)' }}>
              {canEditMainFields ? '支持多张图片上传，保存时会自动上传并关联到 SKU。' : '当前角色仅可查看图片。'}
            </div>
            {canEditMainFields ? (
              <Button htmlType="button" onClick={handlePickImages}>
                选择图片
              </Button>
            ) : null}
          </div>

          {existingImages.length === 0 && pendingImages.length === 0 ? (
            <div
              style={{
                border: '1px dashed #d9d9d9',
                borderRadius: 4,
                padding: 16,
                color: 'rgba(0,0,0,0.45)',
                textAlign: 'center',
              }}
            >
              暂无产品图片
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {existingImages.length > 0 ? (
                <div>
                  <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.88)', fontWeight: 500 }}>已关联图片</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {existingImages.map((image) => (
                      <div
                        key={image.id}
                        style={{
                          width: 132,
                          border: '1px solid #f0f0f0',
                          borderRadius: 4,
                          padding: 8,
                          background: '#fff',
                        }}
                      >
                        <Image
                          src={image.file_url}
                          alt={imageAltText}
                          width={116}
                          height={116}
                          style={{ objectFit: 'cover', borderRadius: 4 }}
                        />
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 12,
                            color: 'rgba(0,0,0,0.65)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={image.filename}
                        >
                          {image.filename}
                        </div>
                        {canEditMainFields ? (
                          <Button
                            htmlType="button"
                            type="link"
                            danger
                            style={{ padding: 0, marginTop: 4 }}
                            onClick={() => removeExistingImage(image.id)}
                          >
                            删除
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {pendingImages.length > 0 ? (
                <div>
                  <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.88)', fontWeight: 500 }}>待上传图片</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pendingImages.map((image) => (
                      <div
                        key={image.key}
                        style={{
                          border: '1px solid #f0f0f0',
                          borderRadius: 4,
                          padding: '8px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: '#fafafa',
                        }}
                      >
                        <div style={{ color: 'rgba(0,0,0,0.65)' }}>{image.file.name}</div>
                        <Button htmlType="button" type="link" danger onClick={() => removePendingImage(image.key)}>
                          删除
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </FormSectionCard>
      </Form>

      <FixedActionBar
        onCancel={() => void leaveCurrentTab()}
        onSave={() => form.submit()}
        loading={saveMutation.isPending}
        saveText={canSave ? '保存' : '无权限保存'}
      />
    </div>
  )
}
