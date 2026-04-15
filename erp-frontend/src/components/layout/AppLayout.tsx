import { Layout } from 'antd'
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useUIStore } from '../../stores/uiStore'
import CacheTabs from './CacheTabs'
import SideMenu, { TAB_LABELS } from './SideMenu'

const { Content } = Layout

export default function AppLayout() {
  const location = useLocation()
  const openTab = useUIStore((s) => s.openTab)

  // 直接 URL 访问或页面刷新时，自动将当前路由同步到 tab 栏
  useEffect(() => {
    const path = location.pathname
    if (path.startsWith('/') && TAB_LABELS[path]) {
      openTab({ key: path, label: TAB_LABELS[path], closable: true })
    }
  }, [location.pathname, openTab])

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <SideMenu />
      <Layout style={{ display: 'flex', flexDirection: 'column' }}>
        <CacheTabs />
        <Content
          style={{
            flex: 1,
            margin: '0 16px 16px',
            overflow: 'auto',
            background: '#f5f5f5',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
