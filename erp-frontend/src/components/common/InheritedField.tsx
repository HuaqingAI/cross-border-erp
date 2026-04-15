// src/components/common/InheritedField.tsx
import type { ReactNode } from 'react'

interface InheritedFieldProps {
  value: ReactNode
  sourceLabel?: string
  className?: string
}

export default function InheritedField({
  value,
  sourceLabel = '继承自 SPU',
  className,
}: InheritedFieldProps) {
  return (
    <div
      aria-readonly="true"
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 32,
        padding: '4px 8px',
        backgroundColor: '#fafafa',
        border: '1px solid #d9d9d9',
        borderRadius: 4,
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
