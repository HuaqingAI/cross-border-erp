import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Space } from 'antd'
import { useAliveController } from 'react-activation'
import { useNavigate } from 'react-router-dom'
import { faqsApi } from '../../../../api/faqs'
import { FormSectionCard } from '../../../../components/common'
import { useUIStore } from '../../../../stores/uiStore'

interface FAQDetailPageProps {
  faqId: string | null
}

export default function FAQDetailPage({ faqId }: FAQDetailPageProps) {
  const navigate = useNavigate()
  const closeTab = useUIStore((state) => state.closeTab)
  const openTab = useUIStore((state) => state.openTab)
  const { drop } = useAliveController()

  const numericFaqId = faqId && Number.isFinite(Number(faqId)) ? Number(faqId) : null
  const currentPath = faqId ? `/products/faqs/${faqId}` : '/products/faqs'

  const leaveCurrentTab = async () => {
    openTab({ key: '/products/faqs', label: 'FAQ管理', closable: true })
    navigate('/products/faqs')
    drop(currentPath)
    closeTab(currentPath)
  }

  const detailQuery = useQuery({
    queryKey: ['faq-detail', numericFaqId],
    queryFn: () => faqsApi.getById(numericFaqId as number),
    enabled: numericFaqId !== null,
  })

  if (numericFaqId === null) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="error"
          message="FAQ 标识无效"
          description="当前详情地址缺少有效的 FAQ ID，请返回列表后重新进入。"
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
          message="FAQ 数据加载失败"
          description="请返回 FAQ 列表后重试，或稍后刷新页面。"
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

  const faq = detailQuery.data

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormSectionCard title="FAQ 信息">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="作用范围">{faq.scope_summary}</Descriptions.Item>
          <Descriptions.Item label="问题类型">{faq.question_type || '—'}</Descriptions.Item>
          <Descriptions.Item label="SPU" span={2}>
            {faq.spu_code && faq.spu_name ? `${faq.spu_code} | ${faq.spu_name}` : '全局'}
          </Descriptions.Item>
          <Descriptions.Item label="问题" span={2}>
            {faq.question}
          </Descriptions.Item>
          <Descriptions.Item label="答案" span={2}>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{faq.answer}</div>
          </Descriptions.Item>
        </Descriptions>
      </FormSectionCard>

      <FormSectionCard title="附件">
        {faq.attachment_file_name && faq.attachment_file_url ? (
          <Space direction="vertical" size={8}>
            <div>文件名：{faq.attachment_file_name}</div>
            <a href={faq.attachment_file_url} target="_blank" rel="noreferrer">
              查看附件
            </a>
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
