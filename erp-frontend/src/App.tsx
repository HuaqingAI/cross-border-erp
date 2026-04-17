import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { AliveScope, KeepAlive } from 'react-activation'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './features/auth/components/ProtectedRoute'
import LoginPage from './features/auth/pages/LoginPage'
import EnumConfigPage from './features/admin/enums/pages/EnumConfigPage'
import CategoryPage from './features/products/categories/pages/CategoryPage'
import CertificateListPage from './features/products/certificates/pages/CertificateListPage'
import DocumentListPage from './features/products/documents/pages/DocumentListPage'
import FAQListPage from './features/products/faqs/pages/FAQListPage'
import ImportPage from './features/products/import/pages/ImportPage'
import SKUListPage from './features/products/skus/pages/SKUListPage'
import SPUDetailPage from './features/products/spus/pages/SPUDetailPage'
import SPUFormPage from './features/products/spus/pages/SPUFormPage'
import SPUListPage from './features/products/spus/pages/SPUListPage'
import PriceListPage from './features/prices/pages/PriceListPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5 * 60 * 1000 },
  },
})

// AntD 主题配置（UX-DR3）
const antdTheme = {
  token: {
    colorPrimary: '#C41D2E',
    borderRadius: 4,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  components: {
    Table: {
      cellPaddingBlock: 12,
      cellPaddingInline: 12,
    },
    Menu: {
      darkItemBg: '#001529',
      darkItemSelectedBg: '#C41D2E',
    },
    Tabs: {
      inkBarColor: '#C41D2E',
      itemActiveColor: '#C41D2E',
      itemSelectedColor: '#C41D2E',
    },
  },
}

function RoutedKeepAlive({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <KeepAlive name={location.pathname} id={location.pathname}>
      {children}
    </KeepAlive>
  )
}

function RoutedSPUFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { spuId } = useParams()

  return (
    <RoutedKeepAlive>
      <SPUFormPage mode={mode} spuId={spuId ?? null} />
    </RoutedKeepAlive>
  )
}

function RoutedSPUDetailPage() {
  const { spuId } = useParams()

  return (
    <RoutedKeepAlive>
      <SPUDetailPage spuId={spuId ?? null} />
    </RoutedKeepAlive>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={antdTheme} locale={zhCN}>
        <BrowserRouter>
          <AliveScope>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route index element={<Navigate to="/products/skus" replace />} />
                  <Route
                    path="/products/categories"
                    element={
                      <KeepAlive name="/products/categories" id="/products/categories">
                        <CategoryPage />
                      </KeepAlive>
                    }
                  />
                  <Route
                    path="/products/spus"
                    element={
                      <KeepAlive name="/products/spus" id="/products/spus">
                        <SPUListPage />
                      </KeepAlive>
                    }
                  />
                  <Route
                    path="/products/spus/new"
                    element={<RoutedSPUFormPage mode="create" />}
                  />
                  <Route
                    path="/products/spus/:spuId"
                    element={<RoutedSPUDetailPage />}
                  />
                  <Route
                    path="/products/spus/:spuId/edit"
                    element={<RoutedSPUFormPage mode="edit" />}
                  />
                  <Route
                    path="/products/skus"
                    element={
                      <KeepAlive name="/products/skus" id="/products/skus">
                        <SKUListPage />
                      </KeepAlive>
                    }
                  />
                  <Route
                    path="/products/certificates"
                    element={
                      <KeepAlive name="/products/certificates" id="/products/certificates">
                        <CertificateListPage />
                      </KeepAlive>
                    }
                  />
                  <Route
                    path="/products/documents"
                    element={
                      <KeepAlive name="/products/documents" id="/products/documents">
                        <DocumentListPage />
                      </KeepAlive>
                    }
                  />
                  <Route
                    path="/products/faqs"
                    element={
                      <KeepAlive name="/products/faqs" id="/products/faqs">
                        <FAQListPage />
                      </KeepAlive>
                    }
                  />
                  <Route
                    path="/prices"
                    element={
                      <KeepAlive name="/prices" id="/prices">
                        <PriceListPage />
                      </KeepAlive>
                    }
                  />
                  <Route
                    path="/import"
                    element={
                      <KeepAlive name="/import" id="/import">
                        <ImportPage />
                      </KeepAlive>
                    }
                  />
                  <Route
                    path="/admin/enums"
                    element={
                      <KeepAlive name="/admin/enums" id="/admin/enums">
                        <EnumConfigPage />
                      </KeepAlive>
                    }
                  />
                  <Route path="*" element={<Navigate to="/products/skus" replace />} />
                </Route>
              </Route>
            </Routes>
          </AliveScope>
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  )
}

export default App
