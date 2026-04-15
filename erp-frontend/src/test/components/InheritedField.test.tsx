// src/test/components/InheritedField.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import InheritedField from '../../components/common/InheritedField'

describe('InheritedField', () => {
  it('渲染传入的值', () => {
    render(<InheritedField value="深圳明达医疗" />)
    expect(screen.getByText('深圳明达医疗')).toBeInTheDocument()
  })

  it('显示默认"继承自 SPU"标签', () => {
    render(<InheritedField value="某供应商" />)
    expect(screen.getByText('继承自 SPU')).toBeInTheDocument()
  })

  it('具有 aria-readonly 属性', () => {
    const { container } = render(<InheritedField value="测试" />)
    const el = container.firstChild as HTMLElement
    expect(el).toHaveAttribute('aria-readonly', 'true')
  })

  it('value 为空时显示占位符 —', () => {
    render(<InheritedField value={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('支持自定义 sourceLabel', () => {
    render(<InheritedField value="医疗器械" sourceLabel="继承自分类" />)
    expect(screen.getByText('继承自分类')).toBeInTheDocument()
  })
})
