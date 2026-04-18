interface SKUFormPageProps {
  mode: 'create' | 'edit'
  skuId: string | null
}

export default function SKUFormPage({ mode, skuId }: SKUFormPageProps) {
  const title = mode === 'create' ? '新增 SKU' : `编辑 SKU ${skuId ?? ''}`.trim()

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
      <h2>{title}</h2>
      <p>Story 4.5 尚未开始，本页当前仅承接 4.4 列表页导航。</p>
    </div>
  )
}
