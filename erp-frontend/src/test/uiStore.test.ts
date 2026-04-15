import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from '../stores/uiStore'

// Reset store state between tests
beforeEach(() => {
  useUIStore.setState({
    tabs: [],
    activeTabKey: '',
    sidebarCollapsed: false,
  })
})

describe('useUIStore', () => {
  describe('openTab', () => {
    it('adds a new tab and sets it as active', () => {
      const { openTab } = useUIStore.getState()
      openTab({ key: '/products/skus', label: 'SKU管理', closable: true })

      const state = useUIStore.getState()
      expect(state.tabs).toHaveLength(1)
      expect(state.tabs[0]).toEqual({ key: '/products/skus', label: 'SKU管理', closable: true })
      expect(state.activeTabKey).toBe('/products/skus')
    })

    it('activates existing tab without duplicating', () => {
      const { openTab } = useUIStore.getState()
      openTab({ key: '/products/skus', label: 'SKU管理', closable: true })
      openTab({ key: '/prices', label: '价格管理', closable: true })
      openTab({ key: '/products/skus', label: 'SKU管理', closable: true })

      const state = useUIStore.getState()
      expect(state.tabs).toHaveLength(2)
      expect(state.activeTabKey).toBe('/products/skus')
    })
  })

  describe('closeTab', () => {
    it('removes a tab and activates previous tab', () => {
      useUIStore.setState({
        tabs: [
          { key: '/products/skus', label: 'SKU管理', closable: true },
          { key: '/prices', label: '价格管理', closable: true },
        ],
        activeTabKey: '/prices',
        sidebarCollapsed: false,
      })

      useUIStore.getState().closeTab('/prices')

      const state = useUIStore.getState()
      expect(state.tabs).toHaveLength(1)
      expect(state.activeTabKey).toBe('/products/skus')
    })

    it('does nothing when closing non-existent tab', () => {
      useUIStore.setState({
        tabs: [{ key: '/products/skus', label: 'SKU管理', closable: true }],
        activeTabKey: '/products/skus',
        sidebarCollapsed: false,
      })

      useUIStore.getState().closeTab('/nonexistent')

      expect(useUIStore.getState().tabs).toHaveLength(1)
    })
  })

  describe('closeOtherTabs', () => {
    it('keeps only the specified tab (and non-closable tabs)', () => {
      useUIStore.setState({
        tabs: [
          { key: '/products/skus', label: 'SKU管理', closable: true },
          { key: '/prices', label: '价格管理', closable: true },
          { key: '/import', label: '数据导入', closable: true },
        ],
        activeTabKey: '/products/skus',
        sidebarCollapsed: false,
      })

      useUIStore.getState().closeOtherTabs('/prices')

      const state = useUIStore.getState()
      expect(state.tabs).toHaveLength(1)
      expect(state.tabs[0].key).toBe('/prices')
      expect(state.activeTabKey).toBe('/prices')
    })
  })

  describe('closeAllTabs', () => {
    it('clears all closable tabs', () => {
      useUIStore.setState({
        tabs: [
          { key: '/products/skus', label: 'SKU管理', closable: true },
          { key: '/prices', label: '价格管理', closable: true },
        ],
        activeTabKey: '/prices',
        sidebarCollapsed: false,
      })

      useUIStore.getState().closeAllTabs()

      const state = useUIStore.getState()
      expect(state.tabs).toHaveLength(0)
      expect(state.activeTabKey).toBe('')
    })

    it('preserves non-closable tabs', () => {
      useUIStore.setState({
        tabs: [
          { key: '/home', label: '首页', closable: false },
          { key: '/prices', label: '价格管理', closable: true },
        ],
        activeTabKey: '/prices',
        sidebarCollapsed: false,
      })

      useUIStore.getState().closeAllTabs()

      const state = useUIStore.getState()
      expect(state.tabs).toHaveLength(1)
      expect(state.tabs[0].key).toBe('/home')
      expect(state.activeTabKey).toBe('/home')
    })
  })

  describe('setSidebarCollapsed', () => {
    it('updates sidebar collapsed state', () => {
      useUIStore.getState().setSidebarCollapsed(true)
      expect(useUIStore.getState().sidebarCollapsed).toBe(true)

      useUIStore.getState().setSidebarCollapsed(false)
      expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    })
  })
})
