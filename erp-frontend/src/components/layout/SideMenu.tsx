import {
  AppstoreOutlined,
  DollarOutlined,
  ImportOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { Layout, Menu } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'
import { useUIStore } from '../../stores/uiStore'

const { Sider } = Layout

// 菜单 key 与页签标题的映射（导出供 AppLayout 刷新同步使用）
export const TAB_LABELS: Record<string, string> = {
  '/products/categories': '分类管理',
  '/products/spus': 'SPU管理',
  '/products/skus': 'SKU管理',
  '/products/certificates': '证书管理',
  '/products/documents': '产品资料',
  '/products/faqs': 'FAQ管理',
  '/prices': '价格管理',
  '/import': '数据导入',
  '/admin/enums': '系统配置',
}

export function resolveTabLabel(path: string): string | undefined {
  if (TAB_LABELS[path]) return TAB_LABELS[path]
  if (path === '/products/spus/new') return '新增SPU'
  if (/^\/products\/spus\/[^/]+\/edit$/.test(path)) return '编辑SPU'
  if (/^\/products\/spus\/[^/]+$/.test(path)) return 'SPU详情'
  return undefined
}

export default function SideMenu() {
  const navigate = useNavigate()
  const location = useLocation()
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed)
  const openTab = useUIStore((s) => s.openTab)
  const permission = usePermission()

  const handleMenuClick = ({ key }: { key: string }) => {
    // 父级菜单组（key 无斜杠前缀）只展开/收起子菜单，不做路由跳转
    if (!key.startsWith('/')) return
    const label = resolveTabLabel(key) ?? key
    openTab({ key, label, closable: true })
    navigate(key)
  }

  // 动态过滤菜单（菜单可见性控制）
  const menuItems = [
    {
      key: 'products',
      icon: <AppstoreOutlined />,
      label: '产品管理',
      children: [
        { key: '/products/categories', label: '分类管理' },
        { key: '/products/spus', label: 'SPU管理' },
        { key: '/products/skus', label: 'SKU管理' },
        { key: '/products/certificates', label: '证书管理' },
        { key: '/products/documents', label: '产品资料' },
        { key: '/products/faqs', label: 'FAQ管理' },
      ],
    },
    {
      key: '/prices',
      icon: <DollarOutlined />,
      label: '价格管理',
    },
    ...(permission.canAccessImport
      ? [{ key: '/import', icon: <ImportOutlined />, label: '数据导入' }]
      : []),
    ...(permission.canAccessAdminConfig
      ? [{ key: '/admin/enums', icon: <SettingOutlined />, label: '系统配置' }]
      : []),
  ]

  // 计算当前选中的菜单项（用于高亮）
  const selectedKey = location.pathname

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      collapsedWidth={48}
      onCollapse={setSidebarCollapsed}
      theme="dark"
      style={{
        background: '#001529',
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        overflow: 'hidden',
        flex: '0 0 auto',
      }}
      trigger={
        collapsed ? (
          <MenuUnfoldOutlined style={{ color: '#fff' }} />
        ) : (
          <MenuFoldOutlined style={{ color: '#fff' }} />
        )
      }
    >
      {/* Logo 区域 */}
      <div
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 16px',
          color: '#C41D2E',
          fontWeight: 700,
          fontSize: collapsed ? 16 : 14,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {collapsed ? 'ERP' : '跨境产品管理'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        defaultOpenKeys={['products']}
        items={menuItems}
        onClick={handleMenuClick}
        style={{
          borderRight: 0,
          height: 'calc(100vh - 48px)',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      />
    </Sider>
  )
}
