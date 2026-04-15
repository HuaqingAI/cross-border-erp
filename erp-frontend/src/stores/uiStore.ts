import { create } from 'zustand'

export interface TabItem {
  key: string     // 路由路径，如 '/products/skus'
  label: string   // 页签标题，如 'SKU管理'
  closable: boolean
}

interface UIStore {
  tabs: TabItem[]
  activeTabKey: string
  sidebarCollapsed: boolean
  // 打开或切换到 tab（若已存在则直接激活）
  openTab: (tab: TabItem) => void
  closeTab: (key: string) => void
  closeOtherTabs: (key: string) => void
  closeAllTabs: () => void
  setActiveTab: (key: string) => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  tabs: [],
  activeTabKey: '',
  sidebarCollapsed: false,

  openTab: (tab) =>
    set((state) => {
      const exists = state.tabs.some((t) => t.key === tab.key)
      if (exists) return { activeTabKey: tab.key }
      return { tabs: [...state.tabs, tab], activeTabKey: tab.key }
    }),

  closeTab: (key) =>
    set((state) => {
      const index = state.tabs.findIndex((t) => t.key === key)
      if (index === -1) return state
      const newTabs = state.tabs.filter((t) => t.key !== key)
      let newActiveKey = state.activeTabKey
      if (state.activeTabKey === key && newTabs.length > 0) {
        newActiveKey = newTabs[Math.max(0, index - 1)].key
      }
      return { tabs: newTabs, activeTabKey: newActiveKey }
    }),

  closeOtherTabs: (key) =>
    set((state) => {
      // 保留不可关闭的 tab（首页） + 当前 tab
      const keep = state.tabs.filter((t) => !t.closable || t.key === key)
      return { tabs: keep, activeTabKey: key }
    }),

  closeAllTabs: () =>
    set((state) => {
      const homeTabs = state.tabs.filter((t) => !t.closable)
      return { tabs: homeTabs, activeTabKey: homeTabs[0]?.key ?? '' }
    }),

  setActiveTab: (key) => set({ activeTabKey: key }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}))
