import type { MenuProps } from 'antd'
import { Dropdown, Tabs } from 'antd'
import { useAliveController } from 'react-activation'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '../../stores/uiStore'

const DEFAULT_ROUTE = '/products/skus'

export default function CacheTabs() {
  const navigate = useNavigate()
  const { drop } = useAliveController()
  const { tabs, activeTabKey, setActiveTab, closeTab, closeOtherTabs, closeAllTabs } =
    useUIStore()

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    navigate(key)
  }

  const handleTabEdit = (targetKey: string | React.MouseEvent | React.KeyboardEvent, action: 'add' | 'remove') => {
    if (action === 'remove' && typeof targetKey === 'string') {
      drop(targetKey) // 清除 KeepAlive 缓存
      const { activeTabKey: currentActive } = useUIStore.getState()
      closeTab(targetKey)
      // 关闭后导航到激活 tab
      const newActive = useUIStore.getState().activeTabKey
      if (currentActive === targetKey && newActive) {
        navigate(newActive)
      }
    }
  }

  const getRightClickMenu = (tabKey: string): MenuProps => ({
    items: [
      {
        key: 'closeOthers',
        label: '关闭其他',
        onClick: () => {
          // 读取最新 tabs 状态（避免陈旧闭包）
          const currentTabs = useUIStore.getState().tabs
          currentTabs.forEach((t) => {
            if (t.key !== tabKey && t.closable) drop(t.key)
          })
          closeOtherTabs(tabKey)
          navigate(tabKey)
        },
      },
      {
        key: 'closeAll',
        label: '关闭所有',
        onClick: () => {
          // 读取最新 tabs 状态（避免陈旧闭包）
          const currentTabs = useUIStore.getState().tabs
          currentTabs.forEach((t) => {
            if (t.closable) drop(t.key)
          })
          closeAllTabs()
          const remainingTabs = useUIStore.getState().tabs
          navigate(remainingTabs[0]?.key ?? DEFAULT_ROUTE)
        },
      },
    ],
  })

  const tabItems = tabs.map((tab) => ({
    key: tab.key,
    label: (
      <Dropdown menu={getRightClickMenu(tab.key)} trigger={['contextMenu']}>
        <span>{tab.label}</span>
      </Dropdown>
    ),
    closable: tab.closable,
  }))

  if (tabs.length === 0) return null

  return (
    <Tabs
      type="editable-card"
      hideAdd
      activeKey={activeTabKey}
      items={tabItems}
      onChange={handleTabChange}
      onEdit={handleTabEdit}
      style={{
        marginBottom: 0,
        background: '#fff',
        paddingLeft: 8,
        paddingRight: 8,
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
      tabBarStyle={{ marginBottom: 0 }}
    />
  )
}
