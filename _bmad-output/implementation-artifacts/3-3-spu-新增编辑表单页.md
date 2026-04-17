# Story 3.3: SPU 新增编辑表单页

**Status:** in-progress
**Story Key:** 3-3-spu-新增编辑表单页
**Epic:** 3 - SPU 管理
**Date:** 2026-04-17

---

## User Story

As a 产品部用户,
I want 通过分区平铺的表单完整录入 SPU 的基础信息、采购信息和开票信息,
So that SPU 数据一次性录入完整，无需多次保存。

---

## Acceptance Criteria

**Given** 用户点击"新增 SPU"  
**When** 表单页打开（新页签）  
**Then** 表单分三个分区（SectionTitle）：基础信息、采购信息、开票信息  
**And** 分类字段为三级联动 Cascader  
**And** 供应商字段为远程搜索 Select（UX-DR14）

**Given** 用户填写开票信息  
**When** 点击"添加开票信息"  
**Then** 开票信息子表新增一行（可编辑表格：开票品名、开票单位、开票型号、公司主体）  
**And** 支持多行新增和删除

**Given** 用户填写完成后点击底部"保存"按钮（FixedActionBar）  
**When** 所有必填字段已填写  
**Then** 保存成功，顶部 message 提示"保存成功"  
**And** 自动关闭当前页签，SPU 列表页签自动刷新

**Given** 用户编辑已有 SPU  
**When** SPU编码字段  
**Then** 显示为只读（disabled + tooltip "创建后不可修改"）

---

## Scope

### In Scope

- 将 `SPUFormPage` 从占位页升级为真实新增/编辑表单
- 新增 SPU 前端 create/get/update API 封装与明细/表单类型
- 对接 3.1 已完成的 `POST /api/v1/spus`、`GET /api/v1/spus/{id}`、`PATCH /api/v1/spus/{id}`、`GET /api/v1/products/categories/tree`
- 表单分区：基础信息、采购信息、开票信息
- 开票信息子表支持新增、删除、编辑
- 保存成功后关闭当前页签并刷新 `/products/spus` 列表页
- 补充前端测试，覆盖新增态、编辑态、校验、保存与导航行为

### Out of Scope

- SPU 详情页真实聚合内容 → Story 3.4
- 供应商主数据、公司主体主数据、国家/单位枚举管理后台
- SKU 侧跳转回填与跨页缓存联动

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-4 | done | 页签导航、KeepAlive、菜单路由已可复用 |
| 1-5 | done | `SectionTitle`、`FixedActionBar` 等通用组件已可复用 |
| 3-1 | done | SPU 创建/详情/更新 API 已可用 |
| 3-2 | review | `/products/spus/new`、`/products/spus/:id/edit` 路由与动态页签标题已接通 |

---

## 实施任务建议

- [ ] Task 1: SPU API 与类型补全
  - [ ] 扩展 `erp-frontend/src/api/spus.ts`，新增 `getById`、`create`、`update`
  - [ ] 在 `erp-frontend/src/types/product.ts` 增补 SPU 明细、开票信息、表单 payload 类型
  - [ ] 封装表单到后端 payload 的转换逻辑

- [ ] Task 2: SPU 表单页主体结构
  - [ ] 重写 `erp-frontend/src/features/products/spus/pages/SPUFormPage.tsx`
  - [ ] 根据路由区分新增态 `/products/spus/new` 与编辑态 `/products/spus/:id/edit`
  - [ ] 页面按三个 `SectionTitle` 分区渲染
  - [ ] 页面底部使用 `FixedActionBar`

- [ ] Task 3: 字段与交互
  - [ ] 分类字段接三级联动 `Cascader`
  - [ ] 供应商字段实现可搜索的远程选择交互或明确降级为普通输入
  - [ ] 开票信息区域实现可编辑子表，支持新增与删除
  - [ ] 编辑态下 `code` 只读并显示不可修改提示

- [ ] Task 4: 保存与页签行为
  - [ ] 新增态提交调用 `POST /api/v1/spus`
  - [ ] 编辑态提交调用 `PATCH /api/v1/spus/{id}`
  - [ ] 保存成功后 `message.success('保存成功')`
  - [ ] 关闭当前表单页签并刷新 SPU 列表页签

- [ ] Task 5: 测试与验证
  - [ ] 新增 `erp-frontend/src/test/features/SPUFormPage.test.tsx`
  - [ ] 覆盖新增态渲染、编辑态回填、编码只读、开票信息增删、保存调用
  - [ ] 跑通前端测试与构建

---

## Dev Notes

### 现有代码基础

- 当前目标页：`erp-frontend/src/features/products/spus/pages/SPUFormPage.tsx`
- 3.2 已打通路由与页签：
  - `/products/spus/new`
  - `/products/spus/:spuId/edit`
- 3.1 后端已提供 SPU create/detail/update 接口与分类树接口
- 现有前端模式优先参考：
  - `erp-frontend/src/features/products/categories/pages/CategoryPage.tsx`
  - `erp-frontend/src/features/products/spus/pages/SPUListPage.tsx`
  - `erp-frontend/src/components/common/FixedActionBar.tsx`

### 关键实现约束

1. 所有数据请求必须走 TanStack Query / mutation，不要在组件里直接调用 axios
2. 当前仓库没有供应商主数据搜索接口，不要临时新增后端接口
3. 当前仓库没有公司主体主数据接口，开票信息中的 `company_subject` 先按文本输入处理
4. `code` 字段在编辑态必须禁用，且提示“创建后不可修改”
5. 保存成功后要关闭当前表单页签并回到 `/products/spus`，同时刷新列表 query
6. 表单容器底部需预留足够空间，避免被 `FixedActionBar` 遮挡
7. 编辑态初始化必须拉取详情接口并把 `invoice_infos` 一起回填

### 表单字段契约补充

后续所有新增/编辑页，复杂字段建议至少明确：

- 组件类型
- 前端默认值
- 提交值类型
- 空值策略

本 Story 已知高风险字段：

- `restricted_countries`
  - 前端默认值：`[]`
  - 提交值类型：`string[]`
  - 空值策略：无值时传 `[]`

- `invoice_infos`
  - 前端默认值：至少一条空行
  - 提交值类型：对象数组
  - 空值策略：数组本身不能是 `undefined`

- `supplier_name`
  - 若无真实远程搜索接口，不要伪装成远程搜索 `Select`
  - 允许明确降级为普通输入

---

## Dev Agent Record

### Debug Log

- 2026-04-17: 恢复 3.3 story 文件到工作区，便于继续本地开发与对照

### Completion Notes

- 当前 story 文件为恢复版，用于继续承接 3.3 本地开发

### File List

- `_bmad-output/implementation-artifacts/3-3-spu-新增编辑表单页.md`

### Change Log

- 2026-04-17: 恢复 story 文件，状态为 in-progress
