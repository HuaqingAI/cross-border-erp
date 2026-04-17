import { useParams } from 'react-router-dom'

export default function SPUDetailPage() {
  const { spuId } = useParams()

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
      <h2 style={{ marginTop: 0 }}>SPU详情</h2>
      <p style={{ marginBottom: 0, color: 'rgba(0,0,0,0.45)' }}>
        当前查看 SPU：{spuId ?? '--'}。3.4 将在这里实现聚合详情页。
      </p>
    </div>
  )
}
