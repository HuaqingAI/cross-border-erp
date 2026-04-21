import { describe, expect, it } from 'vitest'
import type { Faq } from '../../types/product'
import {
  shouldDeletePreviousFaqAttachment,
  toFaqMutationPayload,
  toFAQFormValues,
} from '../../features/products/faqs/pages/FAQFormPage'

const faqDetail: Faq = {
  id: 1,
  spu_id: 11,
  question_type: '售后',
  question: '如何开机？',
  answer: '按电源键',
  scope_summary: 'SPU：SPU001/超声平台',
  spu_code: 'SPU001',
  spu_name: '超声平台',
  attachment_object_key: 'faqs/demo.pdf',
  attachment_file_url: 'http://localhost:9000/erp-files/faqs/demo.pdf',
  attachment_file_name: 'demo.pdf',
  created_at: '2026-04-21T09:00:00Z',
  updated_at: '2026-04-21T10:00:00Z',
}

describe('FAQFormPage helpers', () => {
  it('toFAQFormValues 会回填 FAQ 基础信息', () => {
    expect(toFAQFormValues(faqDetail)).toEqual({
      spu_id: 11,
      question_type: '售后',
      question: '如何开机？',
      answer: '按电源键',
    })
  })

  it('toFaqMutationPayload 会规整空值与 trim 文本', () => {
    expect(
      toFaqMutationPayload(
        {
          spu_id: undefined,
          question_type: ' 售后 ',
          question: ' 如何开机？ ',
          answer: ' 按电源键 ',
        },
        {
          attachment_object_key: null,
          attachment_file_url: null,
          attachment_file_name: null,
        },
      ),
    ).toEqual({
      spu_id: null,
      question_type: '售后',
      question: '如何开机？',
      answer: '按电源键',
      attachment_object_key: null,
      attachment_file_url: null,
      attachment_file_name: null,
    })
  })

  it('shouldDeletePreviousFaqAttachment 能区分清空、替换和保留旧附件', () => {
    expect(
      shouldDeletePreviousFaqAttachment({
        persistedAttachmentObjectKey: 'faqs/old.pdf',
        nextAttachmentObjectKey: null,
        uploadedObjectKey: null,
      }),
    ).toBe(true)

    expect(
      shouldDeletePreviousFaqAttachment({
        persistedAttachmentObjectKey: 'faqs/old.pdf',
        nextAttachmentObjectKey: 'faqs/new.pdf',
        uploadedObjectKey: 'faqs/new.pdf',
      }),
    ).toBe(true)

    expect(
      shouldDeletePreviousFaqAttachment({
        persistedAttachmentObjectKey: 'faqs/old.pdf',
        nextAttachmentObjectKey: 'faqs/old.pdf',
        uploadedObjectKey: null,
      }),
    ).toBe(false)
  })
})
