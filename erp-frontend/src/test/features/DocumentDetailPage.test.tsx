import { describe, expect, it } from 'vitest'
import { sanitizeDocumentHtml } from '../../features/products/documents/pages/DocumentDetailPage'

describe('DocumentDetailPage sanitizeDocumentHtml', () => {
  it('会移除脚本、事件属性和危险链接', () => {
    const sanitized = sanitizeDocumentHtml(
      '<div onclick="alert(1)">正文<script>alert(2)</script><a href="javascript:alert(3)">危险链接</a><a href="https://example.com">安全链接</a></div>',
    )

    expect(sanitized).toContain('<div>正文<a>危险链接</a><a href="https://example.com"')
    expect(sanitized).not.toContain('<script')
    expect(sanitized).not.toContain('onclick=')
    expect(sanitized).not.toContain('javascript:alert(3)')
  })
})
