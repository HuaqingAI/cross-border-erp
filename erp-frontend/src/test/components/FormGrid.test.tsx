import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FormGrid from '../../components/form/FormGrid'

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd')
  return {
    ...actual,
    Grid: {
      useBreakpoint: () => ({
        xs: false,
        sm: false,
        md: false,
        lg: true,
        xl: false,
        xxl: false,
      }),
    },
  }
})

describe('FormGrid', () => {
  it('桌面端默认渲染三列网格', () => {
    const { container } = render(
      <FormGrid>
        <div>字段1</div>
        <div>字段2</div>
        <div>字段3</div>
      </FormGrid>,
    )

    expect(container.firstChild).toHaveStyle({
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(280px, 1fr))',
    })
  })
})
