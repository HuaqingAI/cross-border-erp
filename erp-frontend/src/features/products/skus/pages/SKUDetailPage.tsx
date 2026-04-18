interface SKUDetailPageProps {
  skuId: string | null
}

export default function SKUDetailPage({ skuId }: SKUDetailPageProps) {
  return (
    <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
      <h2>{`SKU详情 ${skuId ?? ''}`.trim()}</h2>
      <p>Story 4.6 尚未开始，本页当前仅承接 4.4 列表页导航。</p>
    </div>
  )
}
