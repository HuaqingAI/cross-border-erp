// src/components/common/FixedActionBar.tsx
import { Button, Space } from 'antd'

interface FixedActionBarProps {
  onSave: () => void
  onCancel: () => void
  loading?: boolean
  saveText?: string
  cancelText?: string
}

export default function FixedActionBar({
  onSave,
  onCancel,
  loading = false,
  saveText = '保存',
  cancelText = '取消',
}: FixedActionBarProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        backgroundColor: '#fff',
        borderTop: '1px solid #f0f0f0',
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
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
