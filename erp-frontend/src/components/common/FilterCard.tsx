// src/components/common/FilterCard.tsx
import type { ReactNode } from 'react'

interface FilterCardProps {
  children: ReactNode
  className?: string
}

export default function FilterCard({ children, className }: FilterCardProps) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: '#fff',
        borderRadius: 4,
        border: '1px solid #f0f0f0',
        padding: '16px 16px 0 16px',
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  )
}
