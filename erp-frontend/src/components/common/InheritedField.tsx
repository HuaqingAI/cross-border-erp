// src/components/common/InheritedField.tsx
import type { CSSProperties, ReactNode } from 'react'

interface InheritedFieldProps {
  value: ReactNode
  sourceLabel?: string
  className?: string
  bordered?: boolean
  style?: CSSProperties
}

export default function InheritedField({
  value,
  sourceLabel = '继承自 SPU',
  className,
  bordered = true,
  style,
}: InheritedFieldProps) {
  return (
    <div
      aria-readonly="true"
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: bordered ? 32 : 'auto',
        padding: bordered ? '4px 8px' : 0,
        backgroundColor: bordered ? '#fafafa' : 'transparent',
        border: bordered ? '1px solid #d9d9d9' : 'none',
        borderRadius: 4,
        ...style,
      }}
    >
      {/* 继承值 */}
      <span style={{ flex: 1, color: 'rgba(0,0,0,0.85)', fontSize: 14 }}>
        {value ?? '—'}
      </span>
      {/* "继承自 SPU" 灰色小标签 */}
      <span
        style={{
          fontSize: 11,
          color: 'rgba(0,0,0,0.35)',
          backgroundColor: '#f0f0f0',
          padding: '1px 6px',
          borderRadius: 2,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {sourceLabel}
      </span>
    </div>
  )
}
