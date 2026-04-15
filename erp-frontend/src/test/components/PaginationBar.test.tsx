// src/test/components/PaginationBar.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import PaginationBar from '../../components/common/PaginationBar'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
})

describe('PaginationBar', () => {
  it('显示正确的总条数', () => {
    render(<PaginationBar total={234} current={1} onChange={vi.fn()} />)
    expect(screen.getByText('234')).toBeInTheDocument()
    // 验证文字包含"共 X 条"
    expect(screen.getByText(/共/).textContent).toContain('234')
  })

  it('total 为 0 时显示"共 0 条"', () => {
    render(<PaginationBar total={0} current={1} onChange={vi.fn()} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
