import { Grid } from 'antd'
import { Children, cloneElement, isValidElement } from 'react'
import type { CSSProperties, ReactNode } from 'react'

interface FormGridProps {
  children: ReactNode
  gap?: number
  rowGap?: number
  columnGap?: number
  minColumnWidth?: number
  itemStyle?: CSSProperties
  style?: CSSProperties
}

export default function FormGrid({
  children,
  gap = 16,
  rowGap,
  columnGap,
  minColumnWidth = 280,
  itemStyle,
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
        columnGap: columnGap ?? gap,
        rowGap: rowGap ?? gap,
        alignItems: 'start',
        ...style,
      }}
    >
      {Children.map(children, (child) => {
        if (!itemStyle || !isValidElement(child)) {
          return child
        }

        const currentStyle =
          typeof child.props === 'object' && child.props !== null && 'style' in child.props
            ? (child.props.style as CSSProperties | undefined)
            : undefined

        return cloneElement(child, {
          style: {
            ...currentStyle,
            ...itemStyle,
          },
        })
      })}
    </div>
  )
}
