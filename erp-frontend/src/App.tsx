import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { AliveScope, KeepAlive } from 'react-activation'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './features/auth/components/ProtectedRoute'
import LoginPage from './features/auth/pages/LoginPage'
import EnumConfigPage from './features/admin/enums/pages/EnumConfigPage'
import CategoryPage from './features/products/categories/pages/CategoryPage'
import CertificateDetailPage from './features/products/certificates/pages/CertificateDetailPage'
import CertificateFormPage from './features/products/certificates/pages/CertificateFormPage'
import CertificateListPage from './features/products/certificates/pages/CertificateListPage'
import DocumentDetailPage from './features/products/documents/pages/DocumentDetailPage'
import DocumentFormPage from './features/products/documents/pages/DocumentFormPage'
import DocumentListPage from './features/products/documents/pages/DocumentListPage'
import FAQDetailPage from './features/products/faqs/pages/FAQDetailPage'
import FAQFormPage from './features/products/faqs/pages/FAQFormPage'
import FAQListPage from './features/products/faqs/pages/FAQListPage'
import ImportPage from './features/products/import/pages/ImportPage'
import SKUDetailPage from './features/products/skus/pages/SKUDetailPage'
import SKUFormPage from './features/products/skus/pages/SKUFormPage'
import SKUListPage from './features/products/skus/pages/SKUListPage'
import SPUDetailPage from './features/products/spus/pages/SPUDetailPage'
import SPUFormPage from './features/products/spus/pages/SPUFormPage'
import SPUListPage from './features/products/spus/pages/SPUListPage'
import PriceDetailPage from './features/prices/pages/PriceDetailPage'
import PriceFormPage from './features/prices/pages/PriceFormPage'
import PriceListPage from './features/prices/pages/PriceListPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5 * 60 * 1000 },
  },
})

const IMPORT_PAGE_CACHE_VERSION =
  typeof __IMPORT_PAGE_CACHE_VERSION__ !== 'undefined' ? __IMPORT_PAGE_CACHE_VERSION__ : 'dev'

const IMPORT_PAGE_CACHE_KEY = `/import@${IMPORT_PAGE_CACHE_VERSION}`

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

function RoutedSKUFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { skuId } = useParams()

  return (
    <RoutedKeepAlive>
      <SKUFormPage mode={mode} skuId={skuId ?? null} />
    </RoutedKeepAlive>
  )
}

function RoutedSKUDetailPage() {
  const { skuId } = useParams()

  return (
    <RoutedKeepAlive>
      <SKUDetailPage skuId={skuId ?? null} />
    </RoutedKeepAlive>
  )
}

function RoutedCertificateFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { certificateId } = useParams()

  return (
    <RoutedKeepAlive>
      <CertificateFormPage mode={mode} certificateId={certificateId ?? null} />
    </RoutedKeepAlive>
  )
}

function RoutedCertificateDetailPage() {
  const { certificateId } = useParams()

  return (
    <RoutedKeepAlive>
      <CertificateDetailPage certificateId={certificateId ?? null} />
    </RoutedKeepAlive>
  )
}

function RoutedDocumentFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { documentId } = useParams()

  return (
    <RoutedKeepAlive>
      <DocumentFormPage mode={mode} documentId={documentId ?? null} />
    </RoutedKeepAlive>
  )
}

function RoutedDocumentDetailPage() {
  const { documentId } = useParams()

  return (
    <RoutedKeepAlive>
      <DocumentDetailPage documentId={documentId ?? null} />
    </RoutedKeepAlive>
  )
}

function RoutedFAQFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { faqId } = useParams()

  return (
    <RoutedKeepAlive>
      <FAQFormPage mode={mode} faqId={faqId ?? null} />
    </RoutedKeepAlive>
  )
}

function RoutedFAQDetailPage() {
  const { faqId } = useParams()

  return (
    <RoutedKeepAlive>
      <FAQDetailPage faqId={faqId ?? null} />
    </RoutedKeepAlive>
  )
}

function RoutedPriceFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { priceId } = useParams()

  return (
    <RoutedKeepAlive>
      <PriceFormPage mode={mode} priceId={priceId ?? null} />
    </RoutedKeepAlive>
  )
}

function RoutedPriceDetailPage() {
  const { priceId } = useParams()

  return (
    <RoutedKeepAlive>
      <PriceDetailPage priceId={priceId ?? null} />
    </RoutedKeepAlive>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={antdTheme} locale={zhCN}>
        <AntdApp>
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
                      path="/products/skus/new"
                      element={<RoutedSKUFormPage mode="create" />}
                    />
                    <Route
                      path="/products/skus/:skuId"
                      element={<RoutedSKUDetailPage />}
                    />
                    <Route
                      path="/products/skus/:skuId/edit"
                      element={<RoutedSKUFormPage mode="edit" />}
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
                      path="/products/certificates/new"
                      element={<RoutedCertificateFormPage mode="create" />}
                    />
                    <Route
                      path="/products/certificates/:certificateId"
                      element={<RoutedCertificateDetailPage />}
                    />
                    <Route
                      path="/products/certificates/:certificateId/edit"
                      element={<RoutedCertificateFormPage mode="edit" />}
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
                      path="/products/documents/new"
                      element={<RoutedDocumentFormPage mode="create" />}
                    />
                    <Route
                      path="/products/documents/:documentId"
                      element={<RoutedDocumentDetailPage />}
                    />
                    <Route
                      path="/products/documents/:documentId/edit"
                      element={<RoutedDocumentFormPage mode="edit" />}
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
                      path="/products/faqs/:faqId"
                      element={<RoutedFAQDetailPage />}
                    />
                    <Route
                      path="/products/faqs/new"
                      element={<RoutedFAQFormPage mode="create" />}
                    />
                    <Route
                      path="/products/faqs/:faqId/edit"
                      element={<RoutedFAQFormPage mode="edit" />}
                    />
                    <Route
                      path="/prices"
                      element={
                        <KeepAlive name="/prices" id="/prices">
                          <PriceListPage />
                        </KeepAlive>
                      }
                    />
                    <Route path="/prices/new" element={<RoutedPriceFormPage mode="create" />} />
                    <Route path="/prices/:priceId" element={<RoutedPriceDetailPage />} />
                    <Route path="/prices/:priceId/edit" element={<RoutedPriceFormPage mode="edit" />} />
                    <Route
                      path="/import"
                      element={
                        <KeepAlive name={IMPORT_PAGE_CACHE_KEY} id={IMPORT_PAGE_CACHE_KEY}>
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
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  )
}

export default App
