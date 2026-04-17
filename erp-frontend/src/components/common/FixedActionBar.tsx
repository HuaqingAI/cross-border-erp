// src/components/common/FixedActionBar.tsx
import { Button, Space } from 'antd'
import type { CSSProperties } from 'react'
import { useUIStore } from '../../stores/uiStore'

interface FixedActionBarProps {
  onSave: () => void
  onCancel: () => void
  loading?: boolean
  saveText?: string
  cancelText?: string
  style?: CSSProperties
}

export default function FixedActionBar({
  onSave,
  onCancel,
  loading = false,
  saveText = '保存',
  cancelText = '取消',
  style,
}: FixedActionBarProps) {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed)
  const sidebarWidth = sidebarCollapsed ? 48 : 200

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: sidebarWidth,
        right: 0,
        padding: '12px 16px',
        backgroundColor: '#fff',
        borderTop: '1px solid #f0f0f0',
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 40,
        ...style,
      }}
    >
      <Space size={12}>
        <Button onClick={onCancel} disabled={loading}>
          {cancelText}
        </Button>
        <Button type="primary" onClick={onSave} loading={loading}>
          {saveText}
        </Button>
      </Space>
    </div>
  )
}
