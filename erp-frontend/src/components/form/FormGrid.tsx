import { Grid } from 'antd'
import type { CSSProperties, ReactNode } from 'react'

interface FormGridProps {
  children: ReactNode
  gap?: number
  minColumnWidth?: number
  style?: CSSProperties
}

export default function FormGrid({
  children,
  gap = 16,
  minColumnWidth = 280,
  style,
}: FormGridProps) {
  const screens = Grid.useBreakpoint()

  let columns = 1
  if (screens.xl || screens.lg) {
    columns = 3
  } else if (screens.md) {
    columns = 2
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(${minColumnWidth}px, 1fr))`,
        gap,
        alignItems: 'start',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
