// src/components/common/PaginationBar.tsx
import { Pagination } from 'antd'

interface PaginationBarProps {
  total: number
  current: number
  pageSize?: number
  onChange: (page: number, pageSize: number) => void
  className?: string
}

export default function PaginationBar({
  total,
  current,
  pageSize = 20,
  onChange,
  className,
}: PaginationBarProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 48,
        marginTop: 12,
        padding: '0 4px',
      }}
    >
      {/* 左侧：共 X 条 */}
      <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14 }}>
        共 <strong style={{ color: 'rgba(0,0,0,0.85)' }}>{total}</strong> 条
      </span>
      {/* 右侧：AntD Pagination */}
      <Pagination
        current={current}
        total={total}
        pageSize={pageSize}
        onChange={onChange}
        showSizeChanger
        showQuickJumper
        pageSizeOptions={[10, 20, 50, 100]}
      />
    </div>
  )
}
