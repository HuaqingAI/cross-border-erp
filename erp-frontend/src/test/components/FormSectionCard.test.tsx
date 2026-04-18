import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FormSectionCard from '../../components/common/FormSectionCard'

describe('FormSectionCard', () => {
  it('渲染卡片标题与内容', () => {
    render(
      <FormSectionCard title="基础信息">
        <div>表单内容</div>
      </FormSectionCard>,
    )

    expect(screen.getByText('基础信息')).toBeInTheDocument()
    expect(screen.getByText('表单内容')).toBeInTheDocument()
  })
})
