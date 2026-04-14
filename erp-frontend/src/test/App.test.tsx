import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import App from '../App'

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider>
        {children}
      </ConfigProvider>
    </QueryClientProvider>
  )
  Wrapper.displayName = 'TestWrapper'
  return Wrapper
}

describe('App', () => {
  it('renders without crashing (smoke test)', () => {
    const Wrapper = createTestWrapper()
    render(
      <Wrapper>
        <App />
      </Wrapper>
    )
    expect(screen.getByText('跨境ERP系统')).toBeInTheDocument()
  })

  it('QueryClient and ConfigProvider wrap App correctly', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <App />
        </ConfigProvider>
      </QueryClientProvider>
    )

    expect(container.firstChild).not.toBeNull()
  })
})
