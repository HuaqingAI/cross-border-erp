# Story 6.3: 资料与 FAQ 管理前端页面

**Status:** review
**Story Key:** 6-3-资料与-faq-管理前端页面
**Epic:** 6 - 产品资料库与 FAQ 管理
**Date:** 2026-04-21

---

## User Story

As a 产品部用户,
I want 在资料管理和 FAQ 管理页面高效维护产品文档和常见问题,
So that 我可以方便地集中管理所有产品相关资料和问答。

---

## Acceptance Criteria

**Given** 用户进入产品资料列表页  
**When** 页面加载完成  
**Then** 筛选区：资料类型、归属类型、关键词  
**And** 表格列：资料名称、资料类型、归属类型、归属范围摘要、创建时间  
**And** 操作：新增、查看、编辑、删除

**Given** 用户新增资料  
**When** 表单页打开  
**Then** 分两个分区：基础资料（名称、类型、富文本内容、文件上传）、归属信息（归属类型、关联对象、国家/地区）  
**And** 归属类型切换时动态显示对应关联字段

**Given** 用户进入 FAQ 列表页  
**When** 页面加载完成  
**Then** 筛选区：SPU（远程搜索）、问题类型、关键词  
**And** 表格列：问题、SPU（空则显示"全局"）、问题类型、创建时间  
**And** 操作：新增、编辑、删除

**Given** 用户新增 FAQ  
**When** 表单页打开  
**Then** 简单表单：SPU（可选，远程搜索）、问题类型、问题、答案、附件上传

---

## Scope

### In Scope

- 产品资料列表页、详情页、新增/编辑页
- FAQ 列表页、新增/编辑页
- 接入 6.1 产品资料 API 与 6.2 FAQ API
- 资料多文件上传、FAQ 单附件上传，复用现有预签名上传工具
- 资料归属类型切换、SKU 远程搜索、分类选择、国家/地区输入
- FAQ 的 SPU 远程搜索与全局 / 指定 SPU 语义展示
- 最小前端测试：查询参数转换、表单 payload 映射、关键渲染和交互

### Out of Scope

- 新的后端数据模型、FAQ / 资料 API 能力扩展
- SPU / SKU 详情聚合展示改造
- 富文本编辑器第三方依赖引入
- 复杂枚举中心、国际化、多主题改造

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-4 | done | 前端应用骨架、页签与 KeepAlive 路由已可复用 |
| 1-5 | done | `FilterCard`、`FormSectionCard`、`FixedActionBar`、`FormGrid` 等通用组件已可复用 |
| 4-3 | done | 预签名上传工具 `upload.ts` 已可复用 |
| 4-5 | review（已合并到 `main`） | SKU 表单页已沉淀复杂表单与远程搜索模式 |
| 5-3 | review（已合并到 `main`） | 证书列表 / 表单 / 详情页已沉淀上传、详情缓存和表单编排模式 |
| 6-1 | review（已合并到 `main`） | 产品资料后端 CRUD API 已可用 |
| 6-2 | review（已合并到 `main`） | FAQ 后端 CRUD API 已可用 |

---

## 实施任务建议

- [x] Task 1: 前端 API / 类型接入
  - [x] 新增 `erp-frontend/src/api/documents.ts`
  - [x] 新增 `erp-frontend/src/api/faqs.ts`
  - [x] 在 `erp-frontend/src/types/product.ts` 增加资料 / FAQ 类型与 payload

- [x] Task 2: 产品资料页面
  - [x] 实现 `DocumentListPage`
  - [x] 新增 `DocumentFormPage`
  - [x] 新增 `DocumentDetailPage`
  - [x] 在路由层显式传入 `mode` 与 `documentId`

- [x] Task 3: FAQ 页面
  - [x] 实现 `FAQListPage`
  - [x] 新增 `FAQFormPage`
  - [x] FAQ 新增 / 编辑页复用 SPU 远程搜索与附件上传底座

- [x] Task 4: 路由与缓存一致性
  - [x] 在 `App.tsx` 注册资料 / FAQ 的列表、详情、表单路由
  - [x] 在 `SideMenu.tsx` 的页签标题解析中补齐资料 / FAQ 路由标题
  - [x] 保存成功后同步更新或失效列表 / 详情缓存

- [x] Task 5: 测试与验证
  - [x] 新增资料页面测试
  - [x] 新增 FAQ 页面测试
  - [x] 跑通前端相关测试与必要构建校验

---

## Dev Notes

### 现有前端基础

- 资料和 FAQ 当前页面仍为占位：
  - `erp-frontend/src/features/products/documents/pages/DocumentListPage.tsx`
  - `erp-frontend/src/features/products/faqs/pages/FAQListPage.tsx`
- 可直接复用的成熟模式优先参考：
  - `erp-frontend/src/features/products/certificates/pages/CertificateListPage.tsx`
  - `erp-frontend/src/features/products/certificates/pages/CertificateFormPage.tsx`
  - `erp-frontend/src/features/products/certificates/pages/CertificateDetailPage.tsx`
  - `erp-frontend/src/features/products/skus/pages/SKUFormPage.tsx`
- 当前前端约束来自 AGENTS / 项目规范：
  - 列表页默认不额外展示页面标题
  - 新增 / 编辑页默认三列表单布局
  - 一级信息块拆为独立卡片
  - 路由层显式传 `mode` 与 `id`
  - 可选数组字段提交前必须兜底为 `[]`

### 关键实现约束

1. 6.3 只做前端页面，不扩展 6.1 / 6.2 后端能力
2. KeepAlive 页面不要自己依赖 `useParams()` 决定模式；必须由路由层传 `mode` / `id`
3. 产品资料页的复杂字段必须明确：
   - `ownership_type`：Radio 按钮组
   - `sku_ids`：多选远程搜索
   - `category_ids`：分类级联 / 多选路径
   - `applicable_countries`：多值输入，提交前兜底为 `[]`
   - `attachments`：多文件附件，提交值类型为数组
4. 资料页建议统一实现 `toFormValues()` 与 `toPayload()`
5. 没有独立远程搜索接口时，SKU / SPU 搜索直接复用现有 `list` API 的 `keyword` 参数
6. FAQ 表单是简单表单，但附件字段仍要保持“整组字段”语义
7. 保存成功后不能只刷新列表缓存；详情页并存时必须同步更新 / 失效详情缓存

### 推荐页面范围

- `/products/documents`
- `/products/documents/new`
- `/products/documents/:documentId`
- `/products/documents/:documentId/edit`
- `/products/faqs`
- `/products/faqs/new`
- `/products/faqs/:faqId/edit`

### References

- `_bmad-output/planning-artifacts/epics.md`（Epic 6 / Story 6.3）
- `_bmad-output/planning-artifacts/prd-product-management.md`（产品资料库管理、FAQ 管理）
- `_bmad-output/implementation-artifacts/4-5-sku-新增编辑表单页.md`
- `_bmad-output/implementation-artifacts/5-3-证书管理前端页面.md`
- `_bmad-output/implementation-artifacts/6-1-产品资料数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/6-2-faq-数据模型与-crud-api.md`

---

## Dev Agent Record

### Debug Log

- 2026-04-21: create-story 完成，已结合 Epic 6、PRD、前端规范、4.5 / 5.3 / 6.1 / 6.2 既有模式补全 6.3 开发上下文
- 2026-04-21: 明确本 Story 只做资料与 FAQ 的前端管理页，不扩展后端模型或 SKU / SPU 聚合页
- 2026-04-21: 新增 `documents.ts` / `faqs.ts` API 接口与前端类型定义，打通 6.1 / 6.2 后端能力
- 2026-04-21: 实现资料列表页、资料详情页、资料新增/编辑页，支持多文件上传、归属切换、SKU 搜索、分类选择和国家/地区输入
- 2026-04-21: 实现 FAQ 列表页与 FAQ 新增/编辑页，支持 SPU 远程搜索、单附件上传与全局 / SPU 作用范围展示
- 2026-04-21: 在 `App.tsx` 与 `SideMenu.tsx` 注册资料 / FAQ 路由与页签标题解析
- 2026-04-21: 前端验证通过，`npm --prefix erp-frontend test` 96/96 通过，`npm --prefix erp-frontend run build` 通过

### Completion Notes

- 已完成资料管理列表页、详情页、新增页、编辑页
- 已完成 FAQ 管理列表页、新增页、编辑页
- 已复用现有 `FilterCard`、`FormSectionCard`、`FixedActionBar`、`FormGrid`、`upload.ts` 与 KeepAlive 路由模式
- 已按前端规范实现路由层显式传 `mode` / `id`，并在保存成功后同步处理列表 / 详情缓存
- 资料页已支持多文件附件、归属类型切换、SKU 远程搜索、分类多选路径与国家/地区 tags 输入
- FAQ 页已支持 SPU 远程搜索、全局 / SPU 作用范围与单附件替换 / 清空语义
- 残余风险：生产构建存在大 chunk 警告（`index` 包体较大），当前不阻塞 6.3 交付，但后续可考虑按页面做进一步代码分割

### File List

- `_bmad-output/implementation-artifacts/6-3-资料与-faq-管理前端页面.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `erp-frontend/src/App.tsx`
- `erp-frontend/src/api/documents.ts`
- `erp-frontend/src/api/faqs.ts`
- `erp-frontend/src/components/layout/SideMenu.tsx`
- `erp-frontend/src/features/products/documents/pages/DocumentDetailPage.tsx`
- `erp-frontend/src/features/products/documents/pages/DocumentFormPage.tsx`
- `erp-frontend/src/features/products/documents/pages/DocumentListPage.tsx`
- `erp-frontend/src/features/products/faqs/pages/FAQFormPage.tsx`
- `erp-frontend/src/features/products/faqs/pages/FAQListPage.tsx`
- `erp-frontend/src/test/features/DocumentFormPage.test.tsx`
- `erp-frontend/src/test/features/DocumentListPage.test.tsx`
- `erp-frontend/src/test/features/FAQFormPage.test.tsx`
- `erp-frontend/src/test/features/FAQListPage.test.tsx`
- `erp-frontend/src/types/product.ts`

### Change Log

- 2026-04-21: 初始创建 Story 6.3 implementation artifact，并进入开发
- 2026-04-21: 完成资料与 FAQ 管理前端页面实现、路由接入、前端测试与构建校验，并将 Story 状态更新为 `review`
