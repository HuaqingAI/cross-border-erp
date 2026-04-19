# Story 4.4: SKU 列表页与筛选

**Status:** done
**Story Key:** 4-4-sku-列表页与筛选
**Epic:** 4 - SKU 完整管理
**Date:** 2026-04-18

---

## User Story

As a 系统用户,
I want 在 SKU 列表页通过分类、供应商、产品状态、产品类型、关键词多维度筛选快速定位目标 SKU,
So that 在 8000+ SKU 中高效找到需要的产品。

---

## Acceptance Criteria

**Given** 用户进入 SKU 列表页  
**When** 页面加载完成  
**Then** 顶部 FilterCard 筛选区：一级/二级/三级分类（级联）、供应商（远程搜索）、产品状态（下拉）、产品类型（下拉）、关键词输入框、查询/重置按钮  
**And** 操作栏左侧："新增"按钮（产品部/管理员可见）  
**And** 表格列：SKU编码、SKU中文名称、产品型号、SPU编码、供应商、产品状态（颜色标签）、创建时间、操作（编辑|查看）  
**And** 底部 PaginationBar

**Given** 用户选择产品状态"下架不可售"  
**When** 点击"查询"  
**Then** 仅显示产品状态为"下架不可售"的 SKU

**Given** 用户在 SKU 列表设置了筛选条件并翻到第 3 页  
**When** 切换到其他页签再切回  
**Then** 筛选条件和分页位置完好保留（KeepAlive）

---

## Scope

### In Scope

- 将 `SKUListPage` 从占位页升级为真实列表页
- 新增 SKU 前端 API 封装与类型定义
- 对接 4.1 已完成的 `GET /api/v1/skus` 与 `GET /api/v1/products/categories/tree`
- 使用 `FilterCard`、`PaginationBar` 复用现有三段式列表页结构
- 实现分类、供应商、产品状态、产品类型、关键词筛选与重置
- 展示“新增 / 查看 / 编辑”操作入口与基础权限边界
- 补充前端测试，覆盖渲染、筛选、重置、权限边界、标签渲染与导航行为

### Out of Scope

- SKU 新增/编辑表单真实页面 → Story 4.5
- SKU 详情页真实聚合内容 → Story 4.6
- SKU 状态字段的独立管理流程在当前版本不再拆分为独立 Story 4.7
- Excel 导入、批量操作、远程供应商主数据接口
- 为 4.4 单独扩展后端接口契约

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-4 | done | 左侧菜单、顶部页签、KeepAlive 路由已可复用 |
| 1-5 | done | `FilterCard`、`PaginationBar` 等通用组件已就绪 |
| 2-2 | done | 分类树 API 封装、TanStack Query 与列表页测试模式已沉淀 |
| 3-2 | done | SPU 列表页前端模式已落地，可直接复用交互骨架 |
| 4-1 | done（已合并） | SKU 列表 API、筛选字段与分页契约已可用 |
| 4-2 | done（已合并） | SKU 报关能力已落地，但不属于本 Story 范围 |
| 4-3 | done（已合并） | SKU 图片底座已落地，但不属于本 Story 范围 |

---

## 实施任务建议

- [x] Task 1: SKU 前端 API 与类型
  - [x] 新增 `erp-frontend/src/api/skus.ts`
  - [x] 在 `erp-frontend/src/types/product.ts` 增补 SKU 列表项、筛选参数与枚举类型
  - [x] 封装分页查询参数，保持与 4.1 后端接口完全对齐

- [x] Task 2: SKU 列表页主体结构
  - [x] 重写 `erp-frontend/src/features/products/skus/pages/SKUListPage.tsx`
  - [x] 页面顶部使用 `FilterCard` 渲染筛选区
  - [x] 中部使用操作栏 + `Table`
  - [x] 底部使用 `PaginationBar`，并关闭 AntD Table 内置分页

- [x] Task 3: 筛选、权限与导航交互
  - [x] 分类筛选使用三级联动 `Cascader`
  - [x] 支持供应商、产品状态、产品类型、关键词筛选
  - [x] 实现“查询 / 重置”按钮行为与分页联动
  - [x] 产品部/管理员可见“新增 / 编辑”，其他角色仅保留“查看”
  - [x] 点击“新增 / 查看 / 编辑”时打开对应 SKU 路由页签，不实现真实业务页内容

- [x] Task 4: 测试与验证
  - [x] 新增 `erp-frontend/src/test/features/SKUListPage.test.tsx`
  - [x] 覆盖基础渲染、筛选参数提交、重置行为、权限边界、状态标签、查看导航
  - [x] 跑通前端相关测试

---

## Dev Notes

### 现有代码基础

- 当前占位页：`erp-frontend/src/features/products/skus/pages/SKUListPage.tsx`
- 4.1 后端已提供：
  - `GET /api/v1/skus`
  - `GET /api/v1/products/categories/tree`
- 现有前端模式优先参考：
  - `erp-frontend/src/features/products/spus/pages/SPUListPage.tsx`
  - `erp-frontend/src/api/spus.ts`
  - `erp-frontend/src/test/features/SPUListPage.test.tsx`

### 关键实现约束

1. 列表页遵循 UX-DR13：`FilterCard + 操作栏 + Table + PaginationBar`
2. 保持紧凑内容区，不额外展示页面标题，不叠加多余外边距
3. 所有数据请求必须走 TanStack Query，不要在组件内直接调用 axios
4. 供应商筛选在当前阶段不要伪装成后端远程搜索；无真实接口时退化为可输入搜索的普通筛选控件或输入框
5. 表格字段以 4.1 当前 API 返回为准，只展示已存在字段，不臆造后端尚未返回的数据
6. 产品状态需使用颜色标签直接展示，颜色映射保持稳定、语义清晰
7. `SKU` 新增/编辑/详情真实页尚未实现，本 Story 只需保证路由跳转与页签打开行为成立
8. KeepAlive 状态保留应主要依赖列表页组件自身状态，不要额外实现一套本地持久化机制

### 推荐类型与 API 形状

- `SkuListItem`
  - `id`
  - `spu_id`
  - `spu_code`
  - `spu_name`
  - `code`
  - `name_zh`
  - `name_en`
  - `product_model`
  - `product_type`
  - `level1_category_id`
  - `level2_category_id`
  - `level3_category_id`
  - `supplier_name`
  - `product_status`
  - `customer_warranty_months`
  - `created_at`
- `SkuListQuery`
  - `page`
  - `page_size`
  - `spu_id?`
  - `level1_category_id?`
  - `level2_category_id?`
  - `level3_category_id?`
  - `supplier_name?`
  - `product_status?`
  - `product_type?`
  - `keyword?`

### 权限与显示建议

- 使用 `usePermission().canCreateProduct` 判断“新增 / 编辑”按钮
- 商务部 / 财务部可浏览列表并使用“查看”入口
- 由于 4.5 / 4.6 尚未开始，列表页只负责打开目标路由，不承担落地业务内容

### 测试重点

- 页面首次加载触发分类树与 SKU 列表查询
- 设置产品状态、产品类型、关键词后点击“查询”会带正确参数重新查询
- 点击“重置”恢复默认查询条件与第一页
- 产品部用户可见“新增 / 编辑”，商务部不可见“新增 / 编辑”
- 产品状态标签按状态文案渲染
- 点击“查看”会触发路由跳转到详情页路径
- `PaginationBar` 翻页会带新页码重新查询

### References

- `_bmad-output/planning-artifacts/epics.md`（Story 4.4）
- `_bmad-output/planning-artifacts/prd-product-management.md`（SKU 列表页）
- `_bmad-output/planning-artifacts/ux-design-specification.md`（UX-DR13、KeepAlive、FilterCard、PaginationBar）
- `_bmad-output/implementation-artifacts/3-2-spu-列表页与筛选.md`
- `_bmad-output/implementation-artifacts/4-1-sku-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/4-2-sku-报关信息维护.md`
- `_bmad-output/implementation-artifacts/4-3-sku-产品图片上传.md`

---

## Dev Agent Record

### Debug Log

- 2026-04-18: create-story 完成，已基于 Epic 4、PRD、UX、4.1 后端契约与 3.2 前端模式生成 4.4 开发上下文
- 2026-04-18: 新增 `skusApi` 与 SKU 列表相关类型，前端查询参数与 4.1 后端 `GET /api/v1/skus` 契约对齐
- 2026-04-18: 将 `SKUListPage` 从占位页升级为真实列表页，完成分类、供应商、产品状态、产品类型、关键词筛选、表格与分页
- 2026-04-18: 为 `/products/skus/new`、`/products/skus/:skuId`、`/products/skus/:skuId/edit` 补齐占位路由页面，仅承接 4.4 导航，不展开 4.5 / 4.6 业务实现
- 2026-04-18: 新增 `SKUListPage` 测试并通过前端全量测试与构建校验
- 2026-04-18: 根据 code review 修复 SKU 新路由页签标题恢复问题，并补齐产品状态、产品类型、分页和 SKU 动态路由标题测试

### Review Findings

- [x] [Review][Patch] SKU 新路由缺少页签标题映射，刷新或直达时不会恢复 tab [`erp-frontend/src/App.tsx:151`]
- [x] [Review][Patch] 4.4 关键验收路径没有测试覆盖 [`erp-frontend/src/test/features/SKUListPage.test.tsx:182`]

### Completion Notes

- 已实现 SKU 列表页三段式结构：FilterCard 筛选区、左侧操作栏、Table、PaginationBar
- 已接入分类树与 SKU 列表接口，支持分类、供应商、产品状态、产品类型、关键词筛选与分页
- 已按权限控制“新增 / 编辑”入口，并保留所有已登录角色的“查看”入口
- 已用颜色标签直接展示产品状态，保持列表层级可快速识别
- 已补齐 SKU 新增 / 详情 / 编辑占位路由，仅用于承接 4.4 导航，不包含 4.5 / 4.6 实际业务
- 前端测试验证完成：`bash scripts/frontend-test.sh` 53/53 通过
- 构建验证完成：`cd erp-frontend && npm run build` 成功（存在 Vite 大包体 warning，但不影响本 Story 交付）
- 已根据 code review 修复 SKU 动态路由页签标题恢复问题
- 已补齐产品状态、产品类型、分页和 SKU 动态路由标题测试覆盖
- code review 修复后再次验证：`bash scripts/frontend-test.sh` 58/58 通过
- code review 修复后再次构建：`cd erp-frontend && npm run build` 成功

### File List

- `_bmad-output/implementation-artifacts/4-4-sku-列表页与筛选.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `erp-frontend/src/api/skus.ts`
- `erp-frontend/src/types/product.ts`
- `erp-frontend/src/features/products/skus/pages/SKUListPage.tsx`
- `erp-frontend/src/features/products/skus/pages/SKUFormPage.tsx`
- `erp-frontend/src/features/products/skus/pages/SKUDetailPage.tsx`
- `erp-frontend/src/test/features/SKUListPage.test.tsx`
- `erp-frontend/src/App.tsx`

### Change Log

- 2026-04-18: Story 创建并进入开发，状态更新为 in-progress
- 2026-04-18: Story 实现完成，前端 53 个测试全部通过，状态更新为 review
- 2026-04-18: 根据 code review 修复页签标题恢复与测试覆盖缺口
- 2026-04-18: code review 修复完成，状态更新为 done
