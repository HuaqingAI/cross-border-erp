// src/test/components/SectionTitle.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SectionTitle from '../../components/common/SectionTitle'

describe('SectionTitle', () => {
  it('渲染标题文字', () => {
    render(<SectionTitle title="基础信息" />)
    expect(screen.getByText('基础信息')).toBeInTheDocument()
  })

  it('具有正确的无障碍属性', () => {
    render(<SectionTitle title="采购信息" />)
    const heading = screen.getByRole('heading')
    expect(heading).toHaveAttribute('aria-level', '3')
  })
})
