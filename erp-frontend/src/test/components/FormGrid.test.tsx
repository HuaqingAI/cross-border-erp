import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Form, Input } from 'antd'
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

  it('支持分别配置横向与纵向间距', () => {
    const { container } = render(
      <FormGrid columnGap={24} rowGap={16}>
        <div>字段1</div>
        <div>字段2</div>
      </FormGrid>,
    )

    expect(container.firstChild).toHaveStyle({
      columnGap: '24px',
      rowGap: '16px',
    })
  })

  it('可为子项统一覆写样式', () => {
    render(
      <Form layout="vertical">
        <FormGrid itemStyle={{ marginBottom: 0 }}>
          <Form.Item label="字段1" name="field1">
            <Input />
          </Form.Item>
        </FormGrid>
      </Form>,
    )

    expect(screen.getByText('字段1').closest('.ant-form-item')).toHaveStyle({
      marginBottom: '0px',
    })
  })
})
