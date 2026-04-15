import { Layout } from 'antd'
import { Outlet } from 'react-router-dom'
import CacheTabs from './CacheTabs'
import SideMenu from './SideMenu'

const { Content } = Layout

export default function AppLayout() {
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
