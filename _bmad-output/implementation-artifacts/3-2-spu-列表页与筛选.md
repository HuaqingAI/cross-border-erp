# Story 3.2: SPU 列表页与筛选

**Status:** done
**Story Key:** 3-2-spu-列表页与筛选
**Epic:** 3 - SPU 管理
**Date:** 2026-04-17

---

## User Story

As a 产品部用户,
I want 在 SPU 列表页通过分类、供应商、关键词筛选快速找到目标 SPU,
So that 我可以高效定位和管理产品型号。

---

## Acceptance Criteria

**Given** 用户进入 SPU 列表页  
**When** 页面加载完成  
**Then** 顶部为 FilterCard 筛选区（分类级联、供应商下拉、关键词输入框、查询/重置按钮）  
**And** 下方为操作栏（左侧"新增"按钮）  
**And** 表格展示 SPU编码、SPU名称、三级分类、供应商、SKU数量、创建时间  
**And** 底部 PaginationBar 左侧显示"共 X 条"，右侧分页控件（UX-DR13）

**Given** 用户输入关键词"超声"  
**When** 点击"查询"  
**Then** 表格刷新，仅显示 SPU编码或名称包含"超声"的记录  
**And** PaginationBar 总数更新

**Given** 用户点击"重置"  
**When** 筛选条件全部清空  
**Then** 表格恢复显示全量数据

**Given** 用户点击表格行"查看"操作  
**When** 进入 SPU 详情页  
**Then** 以新页签打开（UX-DR17）

---

## Scope

### In Scope

- 将 `SPUListPage` 从占位页升级为真实列表页
- 新增 SPU 前端 API 封装与类型定义
- 对接 3.1 已完成的 `GET /api/v1/spus` 与 `GET /api/v1/products/categories/tree`
- 使用 `FilterCard`、`PaginationBar` 组成三段式列表页结构
- 实现分类级联、供应商、关键词筛选与重置
- 展示“新增 / 查看 / 编辑”操作入口与基础权限边界
- 补充前端测试，覆盖渲染、筛选、重置、只读/可写态、导航行为

### Out of Scope

- SPU 新增/编辑表单真实页面 → Story 3.3
- SPU 详情页真实内容 → Story 3.4
- 供应商远程搜索与主数据管理后台
- 后端 SPU 列表接口扩展超出 3.1 已有能力的聚合字段

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-4 | done | 页签导航、KeepAlive、菜单路由已可复用 |
| 1-5 | done | `FilterCard`、`PaginationBar`、`SectionTitle` 等通用组件已可复用 |
| 2-2 | done | 分类页已建立前端 API、TanStack Query 与页面测试模式 |
| 3-1 | done | SPU 列表 API 与分类树 API 已可用，并已合并到 main |

---

## 实施任务建议

- [x] Task 1: SPU 前端 API 与类型
  - [x] 新增 `erp-frontend/src/api/spus.ts`
  - [x] 在 `erp-frontend/src/types/product.ts` 增补 SPU 列表相关类型
  - [x] 封装 SPU 列表查询参数、分页响应与分类树展示所需类型映射

- [x] Task 2: SPU 列表页主体结构
  - [x] 重写 `erp-frontend/src/features/products/spus/pages/SPUListPage.tsx`
  - [x] 页面顶部使用 `FilterCard` 渲染筛选区
  - [x] 中部使用操作栏 + `Table`
  - [x] 底部使用 `PaginationBar`，并关闭 AntD Table 内置分页

- [x] Task 3: 筛选与交互
  - [x] 分类筛选使用三级联动 `Cascader`
  - [x] 支持供应商输入/下拉筛选与关键词筛选
  - [x] 实现“查询 / 重置”按钮行为
  - [x] 点击“查看”跳转到 `/products/spus/:id`
  - [x] “新增”按钮跳转到 `/products/spus/new`

- [x] Task 4: 权限与展示边界
  - [x] 产品部/管理员可见“新增 / 编辑”
  - [x] 商务部/财务部仍可浏览列表与查看详情入口
  - [x] 表格字段与 3.1 当前 API 输出保持一致，不臆造后端尚未返回的数据

- [x] Task 5: 测试与验证
  - [x] 新增 `erp-frontend/src/test/features/SPUListPage.test.tsx`
  - [x] 覆盖基础渲染、筛选参数提交、重置行为、权限边界、查看跳转
  - [x] 跑通前端测试与构建

---

## Dev Notes

### 现有代码基础

- 当前占位页：`erp-frontend/src/features/products/spus/pages/SPUListPage.tsx`
- 3.1 后端已提供：
  - `GET /api/v1/spus`
  - `GET /api/v1/products/categories/tree`
- 现有前端模式优先参考：
  - `erp-frontend/src/features/products/categories/pages/CategoryPage.tsx`
  - `erp-frontend/src/api/categories.ts`
  - `erp-frontend/src/test/features/CategoryPage.test.tsx`

### 关键实现约束

1. 所有数据请求必须走 TanStack Query，不要在组件内直接调 axios
2. 现阶段不要为了 AC 强行要求后端增加 `sku_count`
   - 若 3.1 API 当前未返回该字段，本 Story 应以占位展示或保守展示为准
   - 不要越界修改后端接口契约，除非实现过程中发现确属 3.2 最小必要缺口
3. 分类筛选值建议在前端拆成 `level1_category_id` / `level2_category_id` / `level3_category_id`
4. 重置时应同时清空表单、查询状态并回到第一页
5. 由于 SPU 详情页/表单页尚未实现，`查看` 和 `新增` 跳转只需保证路由跳转发生，不要求目标页完整可用
6. 页面需要遵循 UX-DR13：FilterCard + 操作栏 + Table + PaginationBar
7. 供应商筛选在本阶段可采用普通 `Select` 或可输入搜索的下拉，不要引入新依赖

### 推荐类型与 API 形状

- `SpuListItem`
  - `id`
  - `code`
  - `name`
  - `level1_category_id`
  - `level2_category_id`
  - `level3_category_id`
  - `supplier_name`
  - `customer_warranty_months`
  - `unit`
  - `manufacturer_model`
  - `created_at`
  - `purchase_price?`
- `SpuListQuery`
  - `page`
  - `page_size`
  - `level1_category_id?`
  - `level2_category_id?`
  - `level3_category_id?`
  - `supplier_name?`
  - `keyword?`

### 权限与显示建议

- 使用 `usePermission().canCreateProduct` 判断“新增 / 编辑”按钮
- 使用 `usePermission().canViewPurchasePrice` 决定是否渲染采购价相关补充信息；若本页不展示采购价，可只用于未来扩展
- 对商务部 / 财务部，不要阻断列表查询和“查看”入口

### 测试重点

- 页面首次加载触发分类树与 SPU 列表查询
- 输入关键词后点击“查询”会带正确参数重新查询
- 点击“重置”恢复默认查询条件与第一页
- 产品部用户可见“新增”按钮，商务部不可见“新增 / 编辑”
- 点击“查看”会触发路由跳转到详情页路径
- `PaginationBar` 翻页会带新页码重新查询

### References

- `_bmad-output/planning-artifacts/epics.md`（Story 3.2）
- `_bmad-output/planning-artifacts/prd-product-management.md`（SPU 列表页）
- `_bmad-output/planning-artifacts/ux-design-specification.md`（UX-DR13、FilterCard、PaginationBar）
- `_bmad-output/implementation-artifacts/1-5-通用-ui-组件库.md`
- `_bmad-output/implementation-artifacts/2-2-分类管理前端页面.md`
- `_bmad-output/implementation-artifacts/3-1-spu-数据模型与-crud-api.md`

---

## Dev Agent Record

### Debug Log

- 2026-04-17: create-story 完成，已基于 Epic 3、PRD、UX、3.1 后端输出与 2.2 前端模式生成 3.2 开发上下文
- 2026-04-17: 明确 3.2 以现有 3.1 API 能力为准，不越界扩展后端契约
- 2026-04-17: 新增 `spusApi` 与 SPU 列表类型，完成前端对 3.1 列表接口的封装
- 2026-04-17: 将 `SPUListPage` 从占位页升级为三段式列表页，支持分类/供应商/关键词筛选、分页与重置
- 2026-04-17: 为 `/products/spus/new`、`/products/spus/:spuId`、`/products/spus/:spuId/edit` 补齐占位路由与动态页签标题
- 2026-04-17: 新增 `SPUListPage` 测试并修复 AntD Table 在 jsdom 下的测试兼容问题
- 2026-04-17: 根据 code review 将供应商筛选改为自由输入，避免选项被当前结果页错误约束

### Completion Notes

- 已生成 3.2 故事上下文，供 `dev-story` 直接实施
- 已明确前端 API、筛选状态、分页交互、权限边界和测试重点
- Ultimate context engine analysis completed - comprehensive developer guide created
- 已新增 SPU 列表 API 封装和分页类型，前端查询参数与 3.1 后端接口对齐
- 已实现 `SPUListPage` 的筛选区、操作栏、表格与分页栏，并接入分类树与 SPU 列表查询
- 已实现“新增 / 查看 / 编辑”导航入口及对应占位路由，保证列表页可新开页签进入后续页面
- 已新增 `SPUListPage` 的 5 条前端测试
- 前端验证完成：`bash scripts/frontend-test.sh` 39/39 通过
- 构建验证完成：`npm run build` 成功（存在 Vite 大包体 warning，但不影响本 Story 交付）
- 已根据 code review 修复供应商筛选逻辑，避免筛选项依赖当前页结果集导致无法组合筛选
- 修复后重新验证：`bash scripts/frontend-test.sh` 39/39 通过，`npm run build` 成功

### File List

- `erp-frontend/src/api/spus.ts`
- `erp-frontend/src/types/product.ts`
- `erp-frontend/src/features/products/spus/pages/SPUListPage.tsx`
- `erp-frontend/src/features/products/spus/pages/SPUFormPage.tsx`
- `erp-frontend/src/features/products/spus/pages/SPUDetailPage.tsx`
- `erp-frontend/src/test/features/SPUListPage.test.tsx`
- `erp-frontend/src/components/layout/AppLayout.tsx`
- `erp-frontend/src/components/layout/SideMenu.tsx`
- `erp-frontend/src/App.tsx`
- `_bmad-output/implementation-artifacts/3-2-spu-列表页与筛选.md`
- `_bmad-output/implementation-artifacts/3-1-spu-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-17: Story 创建，状态 ready-for-dev
- 2026-04-17: Story 实现完成，前端 39 个测试全部通过，状态更新为 review
- 2026-04-17: 根据 code review 修复供应商筛选约束问题，本地验证通过
- 2026-04-17: PR 已合并到 main，Story 状态校准为 done
