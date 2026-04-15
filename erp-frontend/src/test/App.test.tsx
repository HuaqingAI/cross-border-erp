import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import App from '../App'

// jsdom doesn't implement matchMedia; mock it for Ant Design responsive components
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

// Mock auth API: getMe rejects so ProtectedRoute redirects to /login
vi.mock('../api/auth', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    getMe: vi.fn().mockRejectedValue(new Error('not authenticated')),
  },
}))

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
  it('renders without crashing (smoke test)', async () => {
    const Wrapper = createTestWrapper()
    render(
      <Wrapper>
        <App />
      </Wrapper>
    )
    // ProtectedRoute checks auth then redirects to /login where the title appears
    expect(await screen.findByText('跨境ERP系统')).toBeInTheDocument()
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
