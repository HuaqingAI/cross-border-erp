import { describe, expect, it } from 'vitest'
import type { CategoryTreeNode, Document, DocumentAttachment } from '../../types/product'
import {
  toDocumentFormValues,
  toDocumentMutationPayload,
} from '../../features/products/documents/pages/DocumentFormPage'

const categoryTree: CategoryTreeNode[] = [
  {
    id: 1,
    code: 'L1',
    name: '一级分类',
    level: 1,
    parent_id: null,
    sort_order: 1,
    children: [
      {
        id: 2,
        code: 'L2',
        name: '二级分类',
        level: 2,
        parent_id: 1,
        sort_order: 1,
        children: [
          {
            id: 3,
            code: 'L3',
            name: '三级分类',
            level: 3,
            parent_id: 2,
            sort_order: 1,
            children: [],
          },
        ],
      },
    ],
  },
]

const attachments: DocumentAttachment[] = [
  {
    id: 10,
    object_key: 'product-documents/a.pdf',
    file_url: 'http://localhost:9000/erp-files/product-documents/a.pdf',
    file_name: 'a.pdf',
    sort_order: 0,
  },
]

const documentDetail: Document = {
  id: 1,
  name: '资料A',
  document_type: '产品手册',
  content_html: '<p>资料内容</p>',
  ownership_type: '按分类',
  ownership_summary: '按分类：三级分类',
  sku_ids: [],
  category_ids: [3],
  applicable_countries: ['US', 'DE'],
  skus: [],
  categories: [
    {
      id: 1,
      category_id: 3,
      category_code: 'L3',
      category_name: '三级分类',
      level: 3,
    },
  ],
  attachments,
  remarks: '备注',
  created_at: '2026-04-21T09:00:00Z',
  updated_at: '2026-04-21T10:00:00Z',
}

describe('DocumentFormPage helpers', () => {
  it('toDocumentFormValues 会回填分类路径与国家地区', () => {
    expect(toDocumentFormValues(documentDetail, categoryTree)).toEqual({
      name: '资料A',
      document_type: '产品手册',
      content_html: '<p>资料内容</p>',
      ownership_type: '按分类',
      sku_ids: [],
      category_paths: [[1, 2, 3]],
      applicable_countries: ['US', 'DE'],
      remarks: '备注',
    })
  })

  it('toDocumentFormValues 会过滤掉历史自由文本国家值', () => {
    expect(
      toDocumentFormValues(
        {
          ...documentDetail,
          applicable_countries: ['China', ' us ', 'GLOBAL'],
        },
        categoryTree,
      ).applicable_countries,
    ).toEqual(['US', 'GLOBAL'])
  })

  it('toDocumentMutationPayload 会按归属类型清空无关字段并规整数组', () => {
    expect(
      toDocumentMutationPayload(
        {
          name: '  资料A  ',
          document_type: ' 产品手册 ',
          content_html: ' <p>资料内容</p> ',
          ownership_type: '通用',
          sku_ids: [1, 2],
          category_paths: [[1, 2, 3]],
      applicable_countries: [' US ', 'DE', ''],
          remarks: ' 备注 ',
        },
        attachments,
      ),
    ).toEqual({
      name: '资料A',
      document_type: '产品手册',
      content_html: '<p>资料内容</p>',
      ownership_type: '通用',
      sku_ids: [],
      category_ids: [],
      applicable_countries: ['US', 'DE'],
      attachments: [
        {
          object_key: 'product-documents/a.pdf',
          file_url: 'http://localhost:9000/erp-files/product-documents/a.pdf',
          file_name: 'a.pdf',
          sort_order: 0,
        },
      ],
      remarks: '备注',
    })
  })

  it('toDocumentMutationPayload 会剥离详情附件里的 id 字段', () => {
    expect(
      toDocumentMutationPayload(
        {
          name: '资料A',
          document_type: '产品手册',
          content_html: '<p>资料内容</p>',
          ownership_type: '通用',
          sku_ids: [],
          category_paths: [],
          applicable_countries: [],
          remarks: '',
        },
        attachments,
      ).attachments,
    ).toEqual([
      {
        object_key: 'product-documents/a.pdf',
        file_url: 'http://localhost:9000/erp-files/product-documents/a.pdf',
        file_name: 'a.pdf',
        sort_order: 0,
      },
    ])
  })

  it('toDocumentMutationPayload 会统一将国家编码转为大写', () => {
    expect(
      toDocumentMutationPayload(
        {
          name: '资料A',
          document_type: '产品手册',
          content_html: '<p>资料内容</p>',
          ownership_type: '通用',
          sku_ids: [],
          category_paths: [],
          applicable_countries: [' cn ', 'global'],
          remarks: '',
        },
        attachments,
      ).applicable_countries,
    ).toEqual(['CN', 'GLOBAL'])
  })
})
