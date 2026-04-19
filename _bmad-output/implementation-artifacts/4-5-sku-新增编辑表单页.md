# Story 4.5: SKU 新增编辑表单页

**Status:** review
**Story Key:** 4-5-sku-新增编辑表单页
**Epic:** 4 - SKU 完整管理
**Date:** 2026-04-18

---

## User Story

As a 产品部用户,
I want 通过平铺分区的长表单一次性完成 SKU 全部信息录入，选择 SPU 后继承字段自动填充,
So that 录入高效、数据继承正确、不遗漏字段。

---

## Acceptance Criteria

**Given** 用户点击"新增 SKU"  
**When** 表单页打开  
**Then** 表单分六个分区（SectionTitle）：基础信息、产品属性、特殊属性、包装信息+包装明细、报关信息、产品图片  
**And** 字段按 3 列 grid 布局

**Given** 用户在基础信息分区选择 SPU（远程搜索 Select）  
**When** 选择完成  
**Then** 继承字段（分类、供应商、禁止经营国家）即时自动填充  
**And** 继承字段以 InheritedField 组件展示（灰色背景 + "继承自 SPU" 标签）（UX-DR8, UX-DR10）  
**And** 客户质保期显示为"继承自 SPU"，只读展示

**Given** 用户输入 SKU 编码后失焦  
**When** 编码已存在  
**Then** 字段下方即时显示红色提示"SKU编码已存在，请更换"（UX-DR12）

**Given** 报关信息分区（产品部视角）  
**When** 表单加载  
**Then** 全部字段灰底只读，顶部提示"报关信息由商务部维护"

**Given** 报关信息分区（商务部视角）  
**When** 表单加载  
**Then** HSCODE、监管条件、申报要素、退税税点、是否已维护均可编辑

**Given** 用户点击底部"保存"（FixedActionBar）  
**When** 校验失败（如必填字段未填）  
**Then** 页面自动滚动到第一个错误字段，红色边框 + 字段下方错误提示（UX-DR12）  
**And** 已填内容不被清空

**Given** 保存成功  
**When** 操作完成  
**Then** 顶部 message 提示"保存成功"  
**And** 自动关闭当前页签，SKU 列表页签自动刷新（UX-DR17）

---

## Scope

### In Scope

- 将 `SKUFormPage` 从占位页升级为真实新增/编辑表单
- 新增 SKU 前端 create/get/update/customs/images API 封装与表单类型
- 对接 4.1 / 4.2 / 4.3 已完成的 SKU 明细、更新、报关、图片上传接口
- 表单分区：基础信息、产品属性、特殊属性、包装信息+包装明细、报关信息、产品图片
- SPU 远程搜索选择、继承字段回显、SKU 编码唯一性失焦校验
- 保存成功后关闭当前页签并刷新 `/products/skus` 列表页
- 补充前端测试，覆盖核心转换逻辑、权限边界、异常态与关键交互

### Out of Scope

- SKU 详情页真实聚合内容 → Story 4.6
- SKU 状态字段保留在当前表单中，当前版本不再拆分独立 Story 4.7
- SPU 新增页联动回填、跨页自动带回新建 SPU
- 供应商、国家、单位、产品类型等主数据后台
- 新增后独立的审核流、导入导出、批量编辑

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-4 | done | 页签导航、KeepAlive、菜单路由已可复用 |
| 1-5 | done | `InheritedField`、`FixedActionBar`、`FormSectionCard`、`FormGrid` 已可复用 |
| 3-3 | done | SPU 表单版式、卡片分区、异常态与测试模式已沉淀 |
| 4-1 | done（已合并） | SKU create/detail/update/list API 已可用 |
| 4-2 | done（已合并） | 报关信息专属更新 API 已可用 |
| 4-3 | done（已合并） | 预签名上传、图片关联/删除接口与前端上传工具已可用 |
| 4-4 | done | SKU 列表页、路由与新增/编辑入口已接通 |

---

## 实施任务建议

- [x] Task 1: SKU API 与类型补全
  - [x] 扩展 `erp-frontend/src/api/skus.ts`，新增 `create`、`update`、`updateCustomsInfo`、`addImage`、`deleteImage`
  - [x] 在 `erp-frontend/src/types/product.ts` 增补 SKU 表单 payload、报关 payload、包装明细输入类型
  - [x] 封装表单值到后端 payload 的转换逻辑

- [x] Task 2: SKU 表单页主体结构
  - [x] 重写 `erp-frontend/src/features/products/skus/pages/SKUFormPage.tsx`
  - [x] 根据路由区分新增态 `/products/skus/new` 与编辑态 `/products/skus/:skuId/edit`
  - [x] 页面按六个独立卡片分区渲染
  - [x] 页面底部使用 `FixedActionBar`

- [x] Task 3: 字段、继承与子表交互
  - [x] SPU 字段实现远程搜索 `Select`
  - [x] 选择 SPU 后回显继承字段（分类、供应商、禁止经营国家、客户质保期）
  - [x] SKU 编码实现失焦唯一性校验
  - [x] 包装明细使用 `Form.List`，支持新增与删除
  - [x] 报关信息按角色区分只读/可编辑
  - [x] 产品图片分区支持展示现有图片、选择待上传图片与删除已有图片

- [x] Task 4: 保存与页签行为
  - [x] 产品部/管理员保存基础 SKU 数据时调用 `POST /api/v1/skus` / `PATCH /api/v1/skus/{id}`
  - [x] 商务部/管理员编辑报关字段时调用 `PATCH /api/v1/skus/{id}/customs-info`
  - [x] 有待上传图片时串行执行预签名上传与图片关联
  - [x] 保存成功后 `message.success('保存成功')`
  - [x] 关闭当前表单页签并刷新 SKU 列表页签

- [x] Task 5: 测试与验证
  - [x] 新增 `erp-frontend/src/test/features/SKUFormPage.test.tsx`
  - [x] 覆盖新增态分区渲染、无效编辑态保护、表单转换逻辑、权限边界、页签关闭行为
  - [x] 跑通前端测试与构建

---

## Dev Notes

### 现有代码基础

- 当前目标页：`erp-frontend/src/features/products/skus/pages/SKUFormPage.tsx`
- 4.4 已打通路由与页签：
  - `/products/skus/new`
  - `/products/skus/:skuId/edit`
- 4.1 / 4.2 / 4.3 后端已提供：
  - `POST /api/v1/skus`
  - `GET /api/v1/skus/{id}`
  - `PATCH /api/v1/skus/{id}`
  - `PATCH /api/v1/skus/{id}/customs-info`
  - `POST /api/v1/skus/{id}/images`
  - `DELETE /api/v1/skus/{id}/images/{image_id}`
  - `POST /api/v1/files/presigned-url`
- 现有前端模式优先参考：
  - `erp-frontend/src/features/products/spus/pages/SPUFormPage.tsx`
  - `erp-frontend/src/features/products/skus/pages/SKUListPage.tsx`
  - `erp-frontend/src/utils/upload.ts`

### 关键实现约束

1. 所有数据请求必须走 TanStack Query / mutation，不要在组件里直接调用 axios
2. 新增/编辑页必须遵循“三列表单 + 独立卡片分区 + 卡片间距 16px + 卡片内紧凑节奏”
3. 继承字段不得混入可编辑 payload；分类、供应商、禁止经营国家、客户质保期只读展示
4. `restricted_countries`、`package_details`、`images` 等数组字段不得假设有值，空值必须兜底为 `[]`
5. 包装明细必须使用 `Form.List`，不要使用临时拼装数组
6. 当前仓库没有 SKU 编码专属校验接口；失焦校验可基于现有列表接口保守实现，但提示文案必须对齐 AC
7. 报关信息写权限仅商务部/管理员；产品部只能看到只读灰底字段
8. 产品图片能力必须复用 4.3 已落地的预签名上传与图片关联接口，不额外发明临时存储方案
9. 当前 Story 不展开 4.6 详情聚合页，也不为 SPU 新增跨页回填补额外工作流

### 表单字段契约补充

- `spu_id`
  - 组件类型：远程搜索 `Select`
  - 前端默认值：`undefined`
  - 提交值类型：`number`
  - 空值策略：创建时必填

- `package_details`
  - 组件类型：`Form.List`
  - 前端默认值：`[]`
  - 提交值类型：对象数组
  - 空值策略：无值时传 `[]`

- `customs_*`
  - 组件类型：产品部只读输入 / 商务部可编辑输入
  - 前端默认值：`null | '' | false`
  - 提交值类型：专属报关 payload
  - 空值策略：未填写时按接口允许的 `null/false` 提交

- `images`
  - 组件类型：已有图片列表 + 待上传文件列表
  - 前端默认值：`[]`
  - 提交值类型：通过 4.3 上传流程落地，不直接进入主表 payload
  - 空值策略：无图片时保留 `[]`

### References

- `_bmad-output/planning-artifacts/epics.md`（Story 4.5）
- `_bmad-output/planning-artifacts/prd-product-management.md`（SKU 新增/编辑页）
- `_bmad-output/planning-artifacts/ux-design-specification.md`（UX-DR8、UX-DR10、UX-DR12、UX-DR17）
- `_bmad-output/implementation-artifacts/3-3-spu-新增编辑表单页.md`
- `_bmad-output/implementation-artifacts/4-1-sku-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/4-2-sku-报关信息维护.md`
- `_bmad-output/implementation-artifacts/4-3-sku-产品图片上传.md`
- `_bmad-output/implementation-artifacts/form-field-contract-template.md`

---

## Dev Agent Record

### Debug Log

- 2026-04-18: create-story 完成，已基于 Epic 4、PRD、UX、3.3 SPU 表单模式与 4.1/4.2/4.3 SKU 接口能力生成 4.5 开发上下文
- 2026-04-18: 扩展 `skusApi` 与 SKU 表单类型，补齐创建、更新、报关、图片关联接口封装
- 2026-04-18: 将 `SKUFormPage` 从占位页升级为六分区表单，完成 SPU 远程搜索、继承字段回显、包装明细、报关区和图片区
- 2026-04-18: 实现产品部/商务部差异化编辑边界，产品部负责基础信息与图片，商务部负责报关信息
- 2026-04-18: 新增 `SKUFormPage` 测试并通过前端全量测试与构建校验
- 2026-04-18: 根据 code review 修复部分成功即离页的问题，并将 SKU 编码实时校验改为精确分页扫描

### Review Findings

- [x] [Review][Patch] 保存链路把报关/图片失败当成成功处理并直接离页 [`erp-frontend/src/features/products/skus/pages/SKUFormPage.tsx:490`]
- [x] [Review][Patch] SKU 编码失焦校验可能漏报重复编码 [`erp-frontend/src/features/products/skus/pages/SKUFormPage.tsx:473`]

### Completion Notes

- 已完成 SKU 新增/编辑表单页实现，覆盖基础信息、产品属性、特殊属性、包装信息+包装明细、报关信息、产品图片六个分区
- 已接通 `create/getById/update/updateCustomsInfo/addImage/deleteImage` API，并在保存链路中串联 SKU 主数据、报关与图片处理
- 已实现 SPU 远程搜索选择、继承字段只读展示、SKU 编码失焦唯一性校验、包装明细 `Form.List`
- 已实现角色边界：产品部/管理员可编辑主表单，商务部/管理员可编辑报关字段，无权限角色直接拦截
- 已补充 `SKUFormPage` 测试，覆盖转换逻辑、分区渲染、无效路由保护、无权限拦截、商务部编辑态边界与取消行为
- 前端测试验证完成：`bash scripts/frontend-test.sh` 64/64 通过
- 构建验证完成：`cd erp-frontend && npm run build` 成功（存在 Vite 大包体 warning，但不影响本 Story 交付）
- 已根据 code review 调整保存链路：报关/图片失败时不再误报成功并直接离页
- 已将 SKU 编码实时校验改为精确分页扫描，避免只看第一页导致漏报
- review 修复后再次验证：`bash scripts/frontend-test.sh` 66/66 通过
- review 修复后再次构建：`cd erp-frontend && npm run build` 成功

### File List

- `_bmad-output/implementation-artifacts/4-5-sku-新增编辑表单页.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `erp-frontend/src/api/skus.ts`
- `erp-frontend/src/types/product.ts`
- `erp-frontend/src/features/products/skus/pages/SKUFormPage.tsx`
- `erp-frontend/src/test/features/SKUFormPage.test.tsx`

### Change Log

- 2026-04-18: Story 创建并进入开发，状态更新为 in-progress
- 2026-04-18: Story 实现完成，状态更新为 review
- 2026-04-18: 根据 code review 修复保存链路与编码校验问题
