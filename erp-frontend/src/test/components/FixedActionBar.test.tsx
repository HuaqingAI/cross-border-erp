// src/test/components/FixedActionBar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FixedActionBar from '../../components/common/FixedActionBar'

describe('FixedActionBar', () => {
  it('渲染保存和取消按钮', () => {
    render(<FixedActionBar onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: /保\s*存/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /取\s*消/ })).toBeInTheDocument()
  })

  it('点击保存触发 onSave 回调', () => {
    const onSave = vi.fn()
    render(<FixedActionBar onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('loading 状态下取消按钮禁用', () => {
    render(<FixedActionBar onSave={vi.fn()} onCancel={vi.fn()} loading={true} />)
    const cancelButton = screen.getByRole('button', { name: /取\s*消/ })
    expect(cancelButton).toBeDisabled()
  })

  it('支持自定义按钮文字', () => {
    render(<FixedActionBar onSave={vi.fn()} onCancel={vi.fn()} saveText="提交" cancelText="返回" />)
    expect(screen.getByRole('button', { name: /提\s*交/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /返\s*回/ })).toBeInTheDocument()
  })
})
