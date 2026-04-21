import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Space, Tag } from 'antd'
import { useAliveController } from 'react-activation'
import { useNavigate } from 'react-router-dom'
import { documentsApi } from '../../../../api/documents'
import { FormSectionCard } from '../../../../components/common'
import { useUIStore } from '../../../../stores/uiStore'

interface DocumentDetailPageProps {
  documentId: string | null
}

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'span',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'a',
])

const DROP_WITH_CONTENT_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'meta', 'link'])

function isSafeHref(href: string): boolean {
  const normalized = href.trim().toLowerCase()
  return (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('mailto:') ||
    normalized.startsWith('tel:') ||
    normalized.startsWith('/') ||
    normalized.startsWith('#')
  )
}

export function sanitizeDocumentHtml(contentHtml: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(contentHtml, 'text/html')

  const sanitizeNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent ?? '')
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null
    }

    const element = node as HTMLElement
    const tagName = element.tagName.toLowerCase()

    if (DROP_WITH_CONTENT_TAGS.has(tagName)) {
      return null
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      const fragment = document.createDocumentFragment()
      Array.from(element.childNodes).forEach((child) => {
        const sanitizedChild = sanitizeNode(child)
        if (sanitizedChild) {
          fragment.appendChild(sanitizedChild)
        }
      })
      return fragment
    }

    const cleanElement = document.createElement(tagName)

    if (tagName === 'a') {
      const href = element.getAttribute('href')
      if (href && isSafeHref(href)) {
        cleanElement.setAttribute('href', href)
        cleanElement.setAttribute('target', '_blank')
        cleanElement.setAttribute('rel', 'noreferrer noopener')
      }
    }

    Array.from(element.childNodes).forEach((child) => {
      const sanitizedChild = sanitizeNode(child)
      if (sanitizedChild) {
        cleanElement.appendChild(sanitizedChild)
      }
    })

    return cleanElement
  }

  const container = document.createElement('div')
  Array.from(doc.body.childNodes).forEach((child) => {
    const sanitizedChild = sanitizeNode(child)
    if (sanitizedChild) {
      container.appendChild(sanitizedChild)
    }
  })
  return container.innerHTML
}

export default function DocumentDetailPage({ documentId }: DocumentDetailPageProps) {
  const navigate = useNavigate()
  const closeTab = useUIStore((state) => state.closeTab)
  const openTab = useUIStore((state) => state.openTab)
  const { drop } = useAliveController()

  const numericDocumentId =
    documentId && Number.isFinite(Number(documentId)) ? Number(documentId) : null
  const currentPath = documentId ? `/products/documents/${documentId}` : '/products/documents'

  const leaveCurrentTab = async () => {
    openTab({ key: '/products/documents', label: '产品资料', closable: true })
    navigate('/products/documents')
    drop(currentPath)
    closeTab(currentPath)
  }

  const detailQuery = useQuery({
    queryKey: ['document-detail', numericDocumentId],
    queryFn: () => documentsApi.getById(numericDocumentId as number),
    enabled: numericDocumentId !== null,
  })

  if (numericDocumentId === null) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="error"
          message="资料标识无效"
          description="当前详情地址缺少有效的资料 ID，请返回列表后重新进入。"
          action={
            <Button type="primary" size="small" onClick={() => void leaveCurrentTab()}>
              返回列表
            </Button>
          }
        />
      </div>
    )
  }

  if (detailQuery.isError) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="error"
          message="资料数据加载失败"
          description="请返回资料列表后重试，或稍后刷新页面。"
          action={
            <Button type="primary" size="small" onClick={() => void leaveCurrentTab()}>
              返回列表
            </Button>
          }
        />
      </div>
    )
  }

  if (!detailQuery.data) {
    return <div style={{ padding: 16 }} />
  }

  const document = detailQuery.data
  const safeContentHtml = document.content_html ? sanitizeDocumentHtml(document.content_html) : ''

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormSectionCard title="基础资料">
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="资料名称">{document.name}</Descriptions.Item>
          <Descriptions.Item label="资料类型">{document.document_type || '—'}</Descriptions.Item>
          <Descriptions.Item label="归属类型">{document.ownership_type}</Descriptions.Item>
          <Descriptions.Item label="归属范围" span={3}>
            {document.ownership_summary}
          </Descriptions.Item>
          <Descriptions.Item label="适用国家/地区" span={3}>
            {document.applicable_countries.length > 0 ? (
              <Space wrap size={[4, 4]}>
                {document.applicable_countries.map((country) => (
                  <Tag key={country}>{country}</Tag>
                ))}
              </Space>
            ) : (
              '全局'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="备注" span={3}>
            {document.remarks || '—'}
          </Descriptions.Item>
        </Descriptions>
      </FormSectionCard>

      <FormSectionCard title="资料内容">
        {safeContentHtml ? (
          <div
            style={{ lineHeight: 1.8, color: 'rgba(0,0,0,0.85)' }}
            dangerouslySetInnerHTML={{ __html: safeContentHtml }}
          />
        ) : (
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>暂无内容</div>
        )}
      </FormSectionCard>

      <FormSectionCard title="关联对象">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="适用SKU" span={2}>
            {document.skus.length > 0
              ? document.skus.map((item) => `${item.sku_code} | ${item.sku_name_zh}`).join('；')
              : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="适用分类" span={2}>
            {document.categories.length > 0
              ? document.categories.map((item) => item.category_name).join('；')
              : '—'}
          </Descriptions.Item>
        </Descriptions>
      </FormSectionCard>

      <FormSectionCard title="附件列表">
        {document.attachments.length > 0 ? (
          <Space direction="vertical" size={8}>
            {document.attachments.map((attachment) => (
              <a key={attachment.object_key} href={attachment.file_url} target="_blank" rel="noreferrer">
                {attachment.file_name}
              </a>
            ))}
          </Space>
        ) : (
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>暂无附件</div>
        )}
      </FormSectionCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={() => void leaveCurrentTab()}>返回列表</Button>
      </div>
    </div>
  )
}
