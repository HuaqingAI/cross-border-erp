import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Empty, Form, Input, Popconfirm, Space, Spin, Tag, Tree, message } from 'antd'
import type { DataNode, TreeProps } from 'antd/es/tree'
import { useEffect, useState } from 'react'
import { categoriesApi } from '../../../../api/categories'
import FilterCard from '../../../../components/common/FilterCard'
import FixedActionBar from '../../../../components/common/FixedActionBar'
import SectionTitle from '../../../../components/common/SectionTitle'
import { usePermission } from '../../../../hooks/usePermission'
import type { CategoryMutationPayload, CategoryTreeNode } from '../../../../types/product'

type EditorMode = 'edit' | 'create-root' | 'create-child'

interface CategoryFormValues {
  code: string
  name: string
}

function findNodeById(
  nodes: CategoryTreeNode[],
  id: number | null,
): CategoryTreeNode | null {
  if (id === null) return null
  for (const node of nodes) {
    if (node.id === id) return node
    const child = findNodeById(node.children, id)
    if (child) return child
  }
  return null
}

function getFirstNode(nodes: CategoryTreeNode[]): CategoryTreeNode | null {
  return nodes[0] ?? null
}

function buildExpandedKeys(nodes: CategoryTreeNode[]): string[] {
  const keys: string[] = []
  for (const node of nodes) {
    keys.push(String(node.id))
    keys.push(...buildExpandedKeys(node.children))
  }
  return keys
}

function toTreeData(nodes: CategoryTreeNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: String(node.id),
    title: (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          width: '100%',
        }}
      >
        <span style={{ color: 'rgba(0,0,0,0.88)' }}>{node.name}</span>
        <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>{node.code}</span>
      </div>
    ),
    children: toTreeData(node.children),
  }))
}

function getSiblings(nodes: CategoryTreeNode[], parentId: number | null): CategoryTreeNode[] {
  if (parentId === null) return [...nodes]
  const parent = findNodeById(nodes, parentId)
  return parent ? [...parent.children] : []
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
  return '操作失败，请稍后重试'
}

export default function CategoryPage() {
  const queryClient = useQueryClient()
  const permission = usePermission()
  const canEdit = permission.canCreateProduct
  const [form] = Form.useForm<CategoryFormValues>()
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [editorMode, setEditorMode] = useState<EditorMode>('edit')
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])

  const categoriesQuery = useQuery({
    queryKey: ['categories-tree'],
    queryFn: categoriesApi.getTree,
  })

  const tree = categoriesQuery.data ?? []
  const selectedCategory = findNodeById(tree, selectedCategoryId)
  const selectedParent =
    editorMode === 'create-child' && selectedCategory
      ? selectedCategory
      : findNodeById(tree, selectedCategory?.parent_id ?? null)

  useEffect(() => {
    if (!tree.length) {
      setSelectedCategoryId(null)
      setExpandedKeys([])
      return
    }

    setExpandedKeys(buildExpandedKeys(tree))
    const current = findNodeById(tree, selectedCategoryId)
    if (!current) {
      const first = getFirstNode(tree)
      if (first) {
        setSelectedCategoryId(first.id)
        setEditorMode('edit')
      }
    }
  }, [tree, selectedCategoryId])

  useEffect(() => {
    if (editorMode === 'create-root') {
      form.setFieldsValue({ code: '', name: '' })
      return
    }

    if (editorMode === 'create-child') {
      form.setFieldsValue({ code: '', name: '' })
      return
    }

    if (selectedCategory) {
      form.setFieldsValue({
        code: selectedCategory.code,
        name: selectedCategory.name,
      })
    }
  }, [editorMode, form, selectedCategory])

  const refreshTree = async () => {
    await queryClient.invalidateQueries({ queryKey: ['categories-tree'] })
  }

  const saveMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      if (editorMode === 'create-root') {
        const payload: CategoryMutationPayload = {
          code: values.code.trim(),
          name: values.name.trim(),
        }
        return categoriesApi.create(payload)
      }

      if (editorMode === 'create-child' && selectedCategory) {
        const payload: CategoryMutationPayload = {
          code: values.code.trim(),
          name: values.name.trim(),
          parent_id: selectedCategory.id,
        }
        return categoriesApi.create(payload)
      }

      if (!selectedCategory) {
        throw new Error('请先选择分类')
      }

      return categoriesApi.update(selectedCategory.id, {
        name: values.name.trim(),
      })
    },
    onSuccess: async (category) => {
      await refreshTree()
      setSelectedCategoryId(category.id)
      setEditorMode('edit')
      message.success('保存成功')
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoriesApi.remove(id),
    onSuccess: async () => {
      const fallbackId = selectedCategory?.parent_id ?? null
      await refreshTree()
      setSelectedCategoryId(fallbackId)
      setEditorMode('edit')
      message.success('删除成功')
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const sortMutation = useMutation({
    mutationFn: async (payload: { draggedId: number; targetId: number; dropPosition: number }) => {
      const draggedNode = findNodeById(tree, payload.draggedId)
      const targetNode = findNodeById(tree, payload.targetId)
      if (!draggedNode || !targetNode) {
        throw new Error('拖拽目标无效')
      }
      if (draggedNode.parent_id !== targetNode.parent_id) {
        throw new Error('仅支持同级分类排序')
      }

      const siblings = getSiblings(tree, draggedNode.parent_id)
      const dragIndex = siblings.findIndex((item) => item.id === draggedNode.id)
      const targetIndex = siblings.findIndex((item) => item.id === targetNode.id)
      if (dragIndex === -1 || targetIndex === -1) {
        throw new Error('排序目标不存在')
      }

      const reordered = [...siblings]
      const [dragItem] = reordered.splice(dragIndex, 1)
      const insertIndex = payload.dropPosition <= 0 ? targetIndex : targetIndex + 1
      reordered.splice(insertIndex, 0, dragItem)

      const changedItems = reordered
        .map((item, index) => ({
          item,
          nextSortOrder: (index + 1) * 10,
        }))
        .filter(({ item, nextSortOrder }) => item.sort_order !== nextSortOrder)
      await Promise.all(
        changedItems.map(({ item, nextSortOrder }) =>
          categoriesApi.updateSort(item.id, { sort_order: nextSortOrder }),
        ),
      )
    },
    onSuccess: async () => {
      await refreshTree()
      message.success('排序已更新')
    },
    onError: (error) => {
      message.warning(getErrorMessage(error))
    },
  })

  const handleCreateRoot = () => {
    setEditorMode('create-root')
    form.setFieldsValue({ code: '', name: '' })
  }

  const handleCreateChild = () => {
    if (!selectedCategory) return
    setEditorMode('create-child')
    form.setFieldsValue({ code: '', name: '' })
  }

  const handleCancel = () => {
    setEditorMode('edit')
    if (selectedCategory) {
      form.setFieldsValue({
        code: selectedCategory.code,
        name: selectedCategory.name,
      })
    } else {
      form.resetFields()
    }
  }

  const handleSelect: TreeProps['onSelect'] = (keys) => {
    if (!keys.length) return
    setSelectedCategoryId(Number(keys[0]))
    setEditorMode('edit')
  }

  const handleDrop: TreeProps['onDrop'] = (info) => {
    if (!canEdit) return
    if (!info.dropToGap) {
      message.warning('仅支持同级分类排序')
      return
    }

    const dropPath = info.node.pos.split('-')
    const relativeDropPosition = info.dropPosition - Number(dropPath[dropPath.length - 1])

    sortMutation.mutate({
      draggedId: Number(info.dragNode.key),
      targetId: Number(info.node.key),
      dropPosition: relativeDropPosition,
    })
  }

  const isCreateMode = editorMode === 'create-root' || editorMode === 'create-child'
  const treeData = toTreeData(tree)

  return (
    <div style={{ padding: 24, minHeight: '100%', paddingBottom: canEdit ? 88 : 24 }}>
      <SectionTitle title="分类管理" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 420px) minmax(420px, 1fr)',
          gap: 16,
        }}
      >
        <FilterCard>
          <Space style={{ marginBottom: 16 }}>
            {canEdit ? (
              <Button type="primary" onClick={handleCreateRoot}>
                新增一级分类
              </Button>
            ) : (
              <Tag color="default">只读模式</Tag>
            )}
            <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>
              支持展开/折叠与同级排序
            </span>
          </Space>

          {categoriesQuery.isLoading ? (
            <div style={{ minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin />
            </div>
          ) : tree.length ? (
            <Tree
              blockNode
              draggable={canEdit ? { icon: false } : false}
              expandedKeys={expandedKeys}
              onExpand={(keys) => setExpandedKeys(keys.map(String))}
              onDrop={handleDrop}
              onSelect={handleSelect}
              selectedKeys={selectedCategoryId ? [String(selectedCategoryId)] : []}
              treeData={treeData}
              style={{ minHeight: 360 }}
            />
          ) : (
            <Empty description="暂无分类数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </FilterCard>

        <div style={{ background: '#fff', borderRadius: 4, border: '1px solid #f0f0f0', padding: 24 }}>
          <SectionTitle
            title={
              editorMode === 'create-root'
                ? '新增一级分类'
                : editorMode === 'create-child'
                  ? '新增子分类'
                  : '分类详情'
            }
          />

          {!selectedCategory && !isCreateMode ? (
            <Empty description="请选择左侧分类节点" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <>
              {editorMode === 'edit' && selectedCategory ? (
                <Space style={{ marginBottom: 16 }} wrap>
                  <Tag color="red">第 {selectedCategory.level} 级</Tag>
                  {selectedCategory.parent_id ? (
                    <Tag color="default">父级 ID: {selectedCategory.parent_id}</Tag>
                  ) : (
                    <Tag color="default">根节点</Tag>
                  )}
                  {canEdit && selectedCategory.level < 3 ? (
                    <Button onClick={handleCreateChild}>新增子分类</Button>
                  ) : null}
                  {canEdit && selectedCategory ? (
                    <Popconfirm
                      title="确认删除该分类？"
                      description="删除后不可恢复，请谨慎操作。"
                      onConfirm={() => deleteMutation.mutate(selectedCategory.id)}
                      okText="删除"
                      cancelText="取消"
                    >
                      <Button danger loading={deleteMutation.isPending}>
                        删除
                      </Button>
                    </Popconfirm>
                  ) : null}
                </Space>
              ) : null}

              {editorMode === 'create-child' && selectedCategory ? (
                <div
                  style={{
                    marginBottom: 16,
                    padding: '12px 16px',
                    background: '#fafafa',
                    border: '1px solid #f0f0f0',
                    borderRadius: 4,
                    color: 'rgba(0,0,0,0.65)',
                  }}
                >
                  将在“{selectedCategory.name}”下新增子分类
                </div>
              ) : null}

              <Form<CategoryFormValues>
                form={form}
                layout="vertical"
                onFinish={(values) => saveMutation.mutate(values)}
                disabled={!canEdit}
              >
                <Form.Item label="分类编码" name="code" rules={[{ required: true, message: '请输入分类编码' }]}>
                  <Input
                    placeholder="请输入分类编码"
                    disabled={!isCreateMode || !canEdit}
                  />
                </Form.Item>
                <Form.Item label="分类名称" name="name" rules={[{ required: true, message: '请输入分类名称' }]}>
                  <Input placeholder="请输入分类名称" disabled={!canEdit} />
                </Form.Item>
                <Form.Item label="层级">
                  <Input
                    value={
                      editorMode === 'create-root'
                        ? '一级分类'
                        : editorMode === 'create-child' && selectedCategory
                          ? `第 ${selectedCategory.level + 1} 级`
                          : selectedCategory
                            ? `第 ${selectedCategory.level} 级`
                            : ''
                    }
                    disabled
                  />
                </Form.Item>
                <Form.Item label="父级分类">
                  <Input
                    value={
                      editorMode === 'create-root'
                        ? '无'
                        : editorMode === 'create-child' && selectedCategory
                          ? selectedCategory.name
                          : selectedParent?.name ?? '无'
                    }
                    disabled
                  />
                </Form.Item>
              </Form>

              {!canEdit ? (
                <Tag color="default">当前角色仅可浏览分类树，编辑功能已禁用</Tag>
              ) : null}
            </>
          )}
        </div>
      </div>

      {canEdit ? (
        <FixedActionBar
          onCancel={handleCancel}
          onSave={() => void form.submit()}
          loading={saveMutation.isPending || deleteMutation.isPending || sortMutation.isPending}
          saveText="保存"
          cancelText="取消"
        />
      ) : null}
    </div>
  )
}
