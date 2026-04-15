// src/test/components/FilterCard.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import FilterCard from '../../components/common/FilterCard'

describe('FilterCard', () => {
  it('渲染子内容', () => {
    render(<FilterCard><span>筛选内容</span></FilterCard>)
    expect(screen.getByText('筛选内容')).toBeInTheDocument()
  })

  it('应用正确的边距样式', () => {
    const { container } = render(<FilterCard><span>内容</span></FilterCard>)
    const card = container.firstChild as HTMLElement
    expect(card.style.backgroundColor).toBe('rgb(255, 255, 255)')
    expect(card.style.borderRadius).toBe('4px')
  })
})
