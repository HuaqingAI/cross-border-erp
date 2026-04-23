import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App as AntdApp,
  Alert,
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Menu,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useState } from 'react'
import { enumsApi } from '../../../../api/enums'
import { FilterCard } from '../../../../components/common'
import { usePermission } from '../../../../hooks/usePermission'
import type {
  SystemEnumCreatePayload,
  SystemEnumGroupSummary,
  SystemEnumItem,
  SystemEnumUpdatePayload,
} from '../../../../types/product'

interface EnumFormValues {
  enum_group: string
  enum_key: string
  enum_value: string
  description?: string
  sort_order: number
  is_enabled: boolean
}

const DEFAULT_FORM_VALUES: EnumFormValues = {
  enum_group: '',
  enum_key: '',
  enum_value: '',
  description: '',
  sort_order: 0,
  is_enabled: true,
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'message' in error.response.data &&
    typeof error.response.data.message === 'string'
  ) {
    return error.response.data.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return '操作失败，请稍后重试'
}

function getNextSortOrder(items: SystemEnumItem[]): number {
  if (items.length === 0) {
    return 10
  }

  return Math.max(...items.map((item) => item.sort_order)) + 10
}

function getEnumKeyPlaceholder(group?: string): string {
  if (group === 'country_region') {
    return '如 CN / US / GLOBAL'
  }
  if (group === 'currency') {
    return '如 CNY / USD / EUR'
  }
  return '请输入稳定编码或业务值'
}

function getEnumValuePlaceholder(group?: string): string {
  if (group === 'country_region') {
    return '如 中国 / 美国 / 全球'
  }
  return '请输入展示文案'
}

function buildCreatePayload(values: EnumFormValues): SystemEnumCreatePayload {
  return {
    enum_group: values.enum_group,
    enum_key: values.enum_key.trim(),
    enum_value: values.enum_value.trim(),
    description: values.description?.trim() || null,
    sort_order: values.sort_order,
    is_enabled: values.is_enabled,
  }
}

function buildUpdatePayload(values: EnumFormValues): SystemEnumUpdatePayload {
  return {
    enum_key: values.enum_key.trim(),
    enum_value: values.enum_value.trim(),
    description: values.description?.trim() || null,
    sort_order: values.sort_order,
    is_enabled: values.is_enabled,
  }
}

export default function EnumConfigPage() {
  const [form] = Form.useForm<EnumFormValues>()
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const permission = usePermission()
  const [selectedGroup, setSelectedGroup] = useState<string>()
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingItem, setEditingItem] = useState<SystemEnumItem | null>(null)

  const groupsQuery = useQuery({
    queryKey: ['system-enum-groups'],
    queryFn: enumsApi.listGroups,
    enabled: permission.canAccessAdminConfig,
  })

  useEffect(() => {
    if (!permission.canAccessAdminConfig) {
      return
    }

    const groups = groupsQuery.data ?? []
    if (groups.length === 0) {
      return
    }

    if (!selectedGroup || !groups.some((group) => group.key === selectedGroup)) {
      setSelectedGroup(groups[0].key)
    }
  }, [groupsQuery.data, permission.canAccessAdminConfig, selectedGroup])

  const enumItemsQuery = useQuery({
    queryKey: ['system-enums', selectedGroup, 'all'],
    queryFn: () =>
      enumsApi.list({
        group: selectedGroup as string,
        include_disabled: true,
      }),
    enabled: permission.canAccessAdminConfig && Boolean(selectedGroup),
  })

  const currentGroup = useMemo<SystemEnumGroupSummary | undefined>(
    () => groupsQuery.data?.find((group) => group.key === selectedGroup),
    [groupsQuery.data, selectedGroup],
  )

  const closeModal = () => {
    setModalMode(null)
    setEditingItem(null)
    form.resetFields()
  }

  const refreshCurrentGroup = async (groupKey?: string) => {
    await queryClient.invalidateQueries({ queryKey: ['system-enum-groups'] })
    await queryClient.invalidateQueries({
      queryKey: ['system-enums', groupKey ?? selectedGroup],
    })
  }

  const saveMutation = useMutation({
    mutationFn: async (values: EnumFormValues) => {
      if (modalMode === 'edit' && editingItem) {
        return enumsApi.update(editingItem.id, buildUpdatePayload(values))
      }
      return enumsApi.create(buildCreatePayload(values))
    },
    onSuccess: async (item) => {
      message.success(modalMode === 'edit' ? '保存成功' : '新增成功')
      setSelectedGroup(item.enum_group)
      closeModal()
      await refreshCurrentGroup(item.enum_group)
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ item, isEnabled }: { item: SystemEnumItem; isEnabled: boolean }) =>
      enumsApi.update(item.id, { is_enabled: isEnabled }),
    onSuccess: async (_, variables) => {
      message.success(variables.isEnabled ? '已启用' : '已停用')
      await refreshCurrentGroup(variables.item.enum_group)
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (item: SystemEnumItem) => enumsApi.remove(item.id),
    onSuccess: async (_, item) => {
      message.success('删除成功')
      await refreshCurrentGroup(item.enum_group)
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const openCreateModal = () => {
    setModalMode('create')
    setEditingItem(null)
    form.setFieldsValue({
      ...DEFAULT_FORM_VALUES,
      enum_group: selectedGroup ?? '',
      sort_order: getNextSortOrder(enumItemsQuery.data ?? []),
      is_enabled: true,
    })
  }

  const openEditModal = (item: SystemEnumItem) => {
    setModalMode('edit')
    setEditingItem(item)
    form.setFieldsValue({
      enum_group: item.enum_group,
      enum_key: item.enum_key,
      enum_value: item.enum_value,
      description: item.description ?? '',
      sort_order: item.sort_order,
      is_enabled: item.is_enabled,
    })
  }

  const handleSubmit = async (values: EnumFormValues) => {
    await saveMutation.mutateAsync(values)
  }

  const columns: ColumnsType<SystemEnumItem> = [
    {
      title: '编码',
      dataIndex: 'enum_key',
      key: 'enum_key',
      width: 180,
      render: (value: string, record) => (
        <Space size={8}>
          <span>{value}</span>
          {record.is_protected ? <Tag color="gold">系统保留</Tag> : null}
        </Space>
      ),
    },
    {
      title: '显示值',
      dataIndex: 'enum_value',
      key: 'enum_value',
      width: 180,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 260,
      render: (value?: string | null) => value || '—',
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      width: 120,
      render: (_: boolean, record) => (
        <Switch
          checked={record.is_enabled}
          checkedChildren="启用"
          unCheckedChildren="停用"
          disabled={record.is_protected || statusMutation.isPending}
          onChange={(checked) => statusMutation.mutate({ item: record, isEnabled: checked })}
        />
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (value: string) => value.slice(0, 16).replace('T', ' '),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" onClick={() => openEditModal(record)}>
            编辑
          </Button>
          {record.is_protected ? (
            <Button type="link" danger disabled>
              删除
            </Button>
          ) : (
            <Popconfirm
              title={`确认删除“${record.enum_value}”吗？`}
              okText="删除"
              cancelText="取消"
              onConfirm={() => deleteMutation.mutate(record)}
            >
              <Button type="link" danger loading={deleteMutation.isPending}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  if (!permission.canAccessAdminConfig) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="error"
          showIcon
          message="无权访问系统枚举配置"
          description="当前页面仅管理员可访问，请使用管理员账号后重试。"
        />
      </div>
    )
  }

  if (groupsQuery.isLoading && !groupsQuery.data) {
    return (
      <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>
        <Spin />
      </div>
    )
  }

  if (groupsQuery.isError) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="error"
          showIcon
          message="枚举组加载失败"
          description="请稍后刷新页面重试。"
        />
      </div>
    )
  }

  return (
    <div
      style={{
        padding: 16,
        display: 'grid',
        gridTemplateColumns: '240px minmax(0, 1fr)',
        gap: 16,
      }}
    >
      <section
        style={{
          background: '#fff',
          borderRadius: 4,
          border: '1px solid #f0f0f0',
          overflow: 'hidden',
          alignSelf: 'start',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 600,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          枚举组
        </div>
        {(groupsQuery.data?.length ?? 0) > 0 ? (
          <Menu
            selectedKeys={selectedGroup ? [selectedGroup] : []}
            items={(groupsQuery.data ?? []).map((group) => ({
              key: group.key,
              label: `${group.label} (${group.enabled_count}/${group.total_count})`,
            }))}
            onClick={({ key }) => setSelectedGroup(key)}
            style={{ borderInlineEnd: 'none' }}
          />
        ) : (
          <div style={{ padding: 24 }}>
            <Empty description="暂无可管理的枚举组" />
          </div>
        )}
      </section>

      <div style={{ minWidth: 0 }}>
        <FilterCard>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>
                {currentGroup?.label || '系统枚举'}
              </div>
              <div style={{ marginTop: 4, color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                {currentGroup?.description || '维护系统级全局枚举值，供后续模块复用。'}
              </div>
            </div>
            <Space>
              <Button type="primary" onClick={openCreateModal} disabled={!selectedGroup}>
                新增枚举值
              </Button>
            </Space>
          </div>
        </FilterCard>

        <section
          style={{
            background: '#fff',
            borderRadius: 4,
            border: '1px solid #f0f0f0',
            overflow: 'hidden',
          }}
        >
          <Table<SystemEnumItem>
            rowKey="id"
            loading={enumItemsQuery.isLoading}
            dataSource={enumItemsQuery.data ?? []}
            columns={columns}
            pagination={false}
            scroll={{ x: 1160 }}
            locale={{ emptyText: selectedGroup ? '当前枚举组暂无数据' : '请选择枚举组' }}
          />
        </section>
      </div>

      <Modal
        title={modalMode === 'edit' ? '编辑枚举值' : '新增枚举值'}
        open={modalMode !== null}
        destroyOnHidden
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        okText={modalMode === 'edit' ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={DEFAULT_FORM_VALUES}
          onFinish={handleSubmit}
        >
          <Form.Item
            label="枚举组"
            name="enum_group"
            rules={[{ required: true, message: '请选择枚举组' }]}
          >
            <Input disabled />
          </Form.Item>
          <Form.Item
            label="编码"
            name="enum_key"
            rules={[{ required: true, message: '请输入枚举编码' }]}
            extra={form.getFieldValue('enum_group') === 'country_region' ? '国家/地区请使用标准编码。' : undefined}
          >
            <Input
              placeholder={getEnumKeyPlaceholder(form.getFieldValue('enum_group'))}
              disabled={Boolean(editingItem?.is_protected)}
            />
          </Form.Item>
          <Form.Item
            label="显示值"
            name="enum_value"
            rules={[{ required: true, message: '请输入显示值' }]}
          >
            <Input placeholder={getEnumValuePlaceholder(form.getFieldValue('enum_group'))} />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 4 }}
              placeholder="选填，补充说明该枚举值的使用场景"
            />
          </Form.Item>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 16,
            }}
          >
            <Form.Item label="排序" name="sort_order" rules={[{ required: true, message: '请输入排序值' }]}>
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="状态" name="is_enabled" valuePropName="checked">
              <Switch
                checkedChildren="启用"
                unCheckedChildren="停用"
                disabled={Boolean(editingItem?.is_protected)}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
