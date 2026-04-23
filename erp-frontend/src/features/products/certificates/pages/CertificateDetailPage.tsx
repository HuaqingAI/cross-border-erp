import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Space, Tag } from 'antd'
import dayjs from 'dayjs'
import { useAliveController } from 'react-activation'
import { useNavigate } from 'react-router-dom'
import { certificatesApi } from '../../../../api/certificates'
import { FormSectionCard } from '../../../../components/common'
import { usePermission } from '../../../../hooks/usePermission'
import { resolveEnumLabel, useSystemEnumItems } from '../../../../hooks/useSystemEnums'
import { useUIStore } from '../../../../stores/uiStore'
import type { CertificateValidityStatus } from '../../../../types/product'

interface CertificateDetailPageProps {
  certificateId: string | null
}

function getStatusColor(status: CertificateValidityStatus): string {
  switch (status) {
    case '有效':
      return 'success'
    case '即将过期':
      return 'warning'
    case '已过期':
      return 'error'
    default:
      return 'default'
  }
}

export default function CertificateDetailPage({ certificateId }: CertificateDetailPageProps) {
  const navigate = useNavigate()
  const permission = usePermission()
  const closeTab = useUIStore((state) => state.closeTab)
  const openTab = useUIStore((state) => state.openTab)
  const { drop } = useAliveController()

  const numericCertificateId =
    certificateId && Number.isFinite(Number(certificateId)) ? Number(certificateId) : null
  const currentPath = certificateId ? `/products/certificates/${certificateId}` : '/products/certificates'

  const leaveCurrentTab = async () => {
    openTab({ key: '/products/certificates', label: '证书管理', closable: true })
    navigate('/products/certificates')
    drop(currentPath)
    closeTab(currentPath)
  }

  const detailQuery = useQuery({
    queryKey: ['certificate-detail', numericCertificateId],
    queryFn: () => certificatesApi.getById(numericCertificateId as number),
    enabled: numericCertificateId !== null,
  })
  const certificateTypeQuery = useSystemEnumItems('certificate_type', numericCertificateId !== null)

  if (numericCertificateId === null) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="error"
          message="证书标识无效"
          description="当前详情地址缺少有效的证书 ID，请返回列表后重新进入。"
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
          message="证书数据加载失败"
          description="请返回证书列表后重试，或稍后刷新页面。"
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

  const certificate = detailQuery.data
  const canEdit = permission.canCreateProduct

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Space>
          <Button onClick={() => void leaveCurrentTab()}>返回列表</Button>
          {canEdit ? (
            <Button
              type="primary"
              onClick={() => {
                openTab({
                  key: `/products/certificates/${certificate.id}/edit`,
                  label: '编辑证书',
                  closable: true,
                })
                navigate(`/products/certificates/${certificate.id}/edit`)
              }}
            >
              编辑
            </Button>
          ) : null}
        </Space>
      </div>

      <FormSectionCard title="基础资料">
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="证书名称">{certificate.name}</Descriptions.Item>
          <Descriptions.Item label="证书编号">{certificate.certificate_no}</Descriptions.Item>
          <Descriptions.Item label="证书类型">
            {resolveEnumLabel(certificateTypeQuery.data, certificate.certificate_type)}
          </Descriptions.Item>
          <Descriptions.Item label="发证机构">{certificate.issuing_authority}</Descriptions.Item>
          <Descriptions.Item label="有效期">
            {dayjs(certificate.valid_from).format('YYYY-MM-DD')} ~{' '}
            {dayjs(certificate.valid_to).format('YYYY-MM-DD')}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={getStatusColor(certificate.validity_status)}>{certificate.validity_status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="说明" span={3}>
            {certificate.remarks || '—'}
          </Descriptions.Item>
        </Descriptions>
      </FormSectionCard>

      <FormSectionCard title="归属信息">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="归属类型">{certificate.ownership_type}</Descriptions.Item>
          <Descriptions.Item label="归属范围">{certificate.ownership_summary}</Descriptions.Item>
          <Descriptions.Item label="适用SPU" span={2}>
            {certificate.spus.length > 0
              ? certificate.spus.map((item) => `${item.spu_code} | ${item.spu_name}`).join('；')
              : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="适用分类" span={2}>
            {certificate.categories.length > 0
              ? certificate.categories.map((item) => item.category_name).join('；')
              : '—'}
          </Descriptions.Item>
        </Descriptions>
      </FormSectionCard>

      <FormSectionCard title="证书文件">
        <Space direction="vertical" size={8}>
          <div>文件名：{certificate.file_name || '—'}</div>
          {certificate.file_url ? (
            <a href={certificate.file_url} target="_blank" rel="noreferrer">
              查看文件
            </a>
          ) : (
            <div>暂无文件</div>
          )}
        </Space>
      </FormSectionCard>
    </div>
  )
}
