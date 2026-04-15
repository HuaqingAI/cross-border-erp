import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
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

describe('App', () => {
  it('renders without crashing (smoke test)', async () => {
    render(<App />)
    // ProtectedRoute checks auth then redirects to /login where the title appears
    expect(await screen.findByText('跨境ERP系统')).toBeInTheDocument()
  })

  it('renders login page when not authenticated', async () => {
    const { container } = render(<App />)
    expect(container.firstChild).not.toBeNull()
    // Should show login page
    expect(await screen.findByText('跨境ERP系统')).toBeInTheDocument()
  })
})
