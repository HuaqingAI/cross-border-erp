# Story 3.4: SPU 详情页（聚合展示）

**Status:** review
**Story Key:** 3-4-spu-详情页
**Epic:** 3 - SPU 管理
**Date:** 2026-04-22

---

## User Story

As a 产品部用户,
I want 在 SPU 详情页一览该型号的完整信息，包括下属 SKU 列表、关联证书和 FAQ,
So that 我无需跳转多个页面即可了解一个产品型号的全貌。

---

## Acceptance Criteria

**Given** 用户进入 SPU 详情页  
**When** 页面加载完成  
**Then** 顶部展示 SPU 全部字段信息（基础信息、采购信息、开票信息）  
**And** 采购价（CNY）字段：产品部和财务部可见，商务部不可见（FR36）

**Given** SPU 详情页底部  
**When** 展示关联数据  
**Then** 显示该 SPU 下的 SKU 列表（SKU编码、SKU中文名称，可点击跳转）（FR7）  
**And** 显示关联证书列表（直接归属该 SPU 的证书 + 通用证书 + 该 SPU 分类匹配的证书）（FR7）  
**And** 显示关联 FAQ 列表（该 SPU 的 FAQ + 全局 FAQ）（FR7）

**Given** SKU 列表中某 SKU  
**When** 用户点击该 SKU 编码  
**Then** 以新页签打开 SKU 详情页

---

## Scope

### In Scope

- 将 `SPUDetailPage` 从占位页升级为真实聚合详情页
- 复用 3.1 的 `GET /api/v1/spus/{id}` 展示基础信息、采购信息、开票信息
- 复用 4.x 已有 `GET /api/v1/skus`，按 `spu_id` 展示下属 SKU 列表
- 复用 5.1 已有 `GET /api/v1/certificates`，基于 `ownership_type / spu_ids / category_ids` 在前端做最小聚合筛选
- 复用 6.2 已有 `GET /api/v1/faqs`，拼装“该 SPU FAQ + 全局 FAQ”
- 维持现有 KeepAlive、页签、查询缓存和详情页组织模式
- 补充前端测试，覆盖详情展示、权限可见性、关联列表与 SKU 跳转

### Out of Scope

- 4.6 SKU 聚合详情页真实实现
- 价格、产品资料、图片等 SKU 聚合内容前置塞入 SPU 详情页
- 后端接口扩展、聚合查询后移或新增专用 SPU 聚合端点
- 通用组件重构、全局布局改造、列表页交互改版

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-4 | done | 页签导航、KeepAlive、动态路由包装模式已可复用 |
| 1-5 | done | `FormSectionCard`、列表/详情展示组件模式已可复用 |
| 1-3 | done | 采购价字段级权限矩阵已落地，前端有 `canViewPurchasePrice` 可复用 |
| 3-1 | done | SPU 详情接口已返回基础信息、采购信息、开票信息，并处理采购价可见性 |
| 3-2 | done | SPU 列表页已接通 `/products/spus/:spuId` 查看入口 |
| 3-3 | done | SPU 字段分区、字段命名、开票信息结构已收敛 |
| 4-4 | done | SKU 列表查询与路由模式已可复用 |
| 5-1 | review（已合并到 main） | 证书列表接口已返回 `ownership_type / spu_ids / category_ids / ownership_summary` |
| 6-2 | review（已合并到 main） | FAQ 列表接口已支持 `spu_id` 过滤和全局 FAQ 表达 |
| 5-3 / 6-3 | review（已合并到 main） | 证书 / FAQ 详情页与列表展示模式可直接参考 |

---

## 实施任务建议

- [x] Task 1: SPU 详情聚合数据接入
  - [x] 在 `erp-frontend/src/api/spus.ts` / `src/types/product.ts` 评估并补齐 3.4 所需最小类型
  - [x] 组合 `spusApi.getById`、`skusApi.list`、`certificatesApi.list`、`faqsApi.list`
  - [x] 明确证书 / FAQ 前端筛选与去重规则，保持命名稳定

- [x] Task 2: SPU 详情页主体结构
  - [x] 重写 `erp-frontend/src/features/products/spus/pages/SPUDetailPage.tsx`
  - [x] 顶部使用紧凑内容区 + 多个 `FormSectionCard` 展示基础信息、采购信息、开票信息
  - [x] 底部使用独立卡片展示 SKU 列表、关联证书列表、关联 FAQ 列表

- [x] Task 3: 权限与跳转交互
  - [x] 采购价字段按 `usePermission().canViewPurchasePrice` 控制显隐
  - [x] 点击 SKU 编码时通过页签系统新开 `/products/skus/:skuId`
  - [x] 返回行为、页签标题、异常态与当前仓库详情页风格保持一致

- [x] Task 4: 查询缓存与稳定性
  - [x] 详情页只依赖路由层传入的 `spuId`
  - [x] 复用现有 TanStack Query key 习惯，避免破坏列表 / 详情缓存
  - [x] 证书 / FAQ 聚合只消费现有接口，不侵入 4.6 或新增后端能力

- [x] Task 5: 测试与验证
  - [x] 新增 `erp-frontend/src/test/features/SPUDetailPage.test.tsx`
  - [x] 覆盖详情字段展示、采购价权限、SKU 编码跳转、证书 / FAQ 聚合结果
  - [x] 跑通前端至少一项现有可执行验证（测试 / lint / build）

---

## Dev Notes

### 现有前端基础

- 当前占位页：`erp-frontend/src/features/products/spus/pages/SPUDetailPage.tsx`
- 路由层已经显式传入 `spuId`：
  - `App.tsx` → `RoutedSPUDetailPage`
- SKU 详情页路由已经存在：
  - `/products/skus/:skuId`
  - 当前 `SKUDetailPage` 仍是 4.6 占位页，但足以承接 3.4 的“新页签打开”
- 可直接参考的详情页模式：
  - `erp-frontend/src/features/products/certificates/pages/CertificateDetailPage.tsx`
  - `erp-frontend/src/features/products/faqs/pages/FAQDetailPage.tsx`

### 关键实现约束

1. 3.4 只做 SPU 聚合详情页，不提前实现 4.6 SKU 聚合详情逻辑
2. KeepAlive 页面不要自行依赖 `useParams()` 决定核心模式；页面组件只消费 `spuId` props
3. 详情页保持紧凑内容区，不重复叠加额外页面标题和外边距
4. 顶部信息区优先复用 `FormSectionCard + Descriptions` 组合，不重造通用详情框架
5. 采购价字段不允许前端“猜测权限”；仅以后端返回结果和 `canViewPurchasePrice` 双重约束渲染
6. 当前证书列表接口没有现成 `spu_id / category_id` 查询参数，3.4 应基于现有列表返回的 `ownership_type / spu_ids / category_ids` 做前端最小过滤，不扩展后端
7. FAQ 聚合需拼装两类数据：
   - `spu_id = 当前 SPU`
   - `spu_id` 为空的全局 FAQ
8. 聚合结果展示命名可为后续 4.6 预留稳定字段含义，但不要提前做 SKU 资料 / 价格 / 证书全量聚合逻辑

### 推荐展示结构

- 顶部操作区：
  - 返回列表
  - 如当前角色可写，则展示“编辑”
- 信息卡片：
  - 基础信息
  - 采购信息
  - 开票信息
- 聚合卡片：
  - 下属 SKU
  - 关联证书
  - 关联 FAQ

### 推荐字段与展示重点

- 基础信息：
  - SPU编码、SPU名称、一级/二级/三级分类、客户质保期、单位、禁止经营国家、创建时间、更新时间
- 采购信息：
  - 供应商、厂家型号、采购质保期、供应商质保说明、采购价（受权限控制）
- 开票信息：
  - 开票品名、开票单位、开票型号、公司主体
- SKU 列表：
  - `code`
  - `name_zh`
- 证书列表：
  - `name`
  - `certificate_no`
  - `certificate_type`
  - `ownership_summary`
  - `validity_status`
- FAQ 列表：
  - `question`
  - `question_type`
  - `scope_summary`

### 聚合规则建议

- 证书：
  - `ownership_type = 通用` → 直接纳入
  - `ownership_type = SPU归属` 且 `spu_ids` 包含当前 `spu.id` → 纳入
  - `ownership_type = 按分类` 且 `category_ids` 命中当前 SPU 的三级分类路径任一节点 → 纳入
  - 结果按 `id` 去重
- FAQ：
  - 取当前 SPU FAQ 与全局 FAQ 两组结果
  - 合并后按 `id` 去重，保持“指定 SPU 在前，全局在后”更易读

### References

- `_bmad-output/planning-artifacts/epics.md`（Story 3.4）
- `_bmad-output/planning-artifacts/prd-product-management.md`（SPU 详情页、FR7）
- `_bmad-output/planning-artifacts/ux-design-specification.md`（详情页模式、KeepAlive）
- `_bmad-output/implementation-artifacts/1-3-rbac-权限矩阵与字段级权限.md`
- `_bmad-output/implementation-artifacts/3-1-spu-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/3-2-spu-列表页与筛选.md`
- `_bmad-output/implementation-artifacts/3-3-spu-新增编辑表单页.md`
- `_bmad-output/implementation-artifacts/5-1-证书数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/6-2-faq-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/5-3-证书管理前端页面.md`
- `_bmad-output/implementation-artifacts/6-3-资料与-faq-管理前端页面.md`

---

## Dev Agent Record

### Debug Log

- 2026-04-22: create-story 完成，已基于 Epic 3、PRD、前端约定、3.1/3.2/3.3 以及 5.1/6.2 现有接口契约生成 3.4 开发上下文
- 2026-04-22: 完成 `SPUDetailPage` 实现，复用现有详情页结构展示基础信息、采购信息、开票信息，以及下属 SKU / 关联证书 / 关联 FAQ
- 2026-04-22: 证书聚合按“通用 + SPU归属 + 分类命中”组合筛选，FAQ 聚合按“SPU FAQ + 全局 FAQ”组合并按 `id` 去重
- 2026-04-22: 新增 `SPUDetailPage` 专项测试，覆盖字段展示、采购价权限与 SKU 新页签跳转；前端专项测试、全量测试与构建验证通过

### Completion Notes

- 已完成 SPU 详情页真实实现，顶部展示基础信息、采购信息、开票信息，底部展示 SKU / 证书 / FAQ 三个聚合列表
- 已按角色控制采购价字段可见性：产品部 / 财务部 / 管理员可见，商务部不可见
- 已支持点击 SKU 编码通过页签系统打开 `/products/skus/:skuId`，但未越界实现 4.6 的 SKU 聚合详情内容
- 证书聚合仅消费现有 `certificates` 列表接口，在前端基于 `ownership_type / spu_ids / category_ids` 做最小过滤；FAQ 聚合仅消费现有 `faqs` 列表接口
- 已新增 `SPUDetailPage` 测试并完成验证：专项测试通过、前端全量测试 `125/125` 通过、构建通过
- `npm --prefix erp-frontend run lint` 当前不可执行：仓库前端环境缺少 `eslint` 可执行文件，本次未额外安装依赖以避免越界改动

### File List

- `_bmad-output/implementation-artifacts/3-4-spu-详情页.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `erp-frontend/src/features/products/spus/pages/SPUDetailPage.tsx`
- `erp-frontend/src/test/features/SPUDetailPage.test.tsx`

### Change Log

- 2026-04-22: 初始创建 Story 3.4 implementation artifact，并进入开发
- 2026-04-22: 完成 SPU 聚合详情页实现、前端测试与构建验证，状态更新为 `review`
