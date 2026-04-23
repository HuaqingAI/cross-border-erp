# Story 4.6: SKU 详情页（聚合展示）

**Status:** review
**Story Key:** 4-6-sku-详情页
**Epic:** 4 - SKU 完整管理
**Date:** 2026-04-23

---

## User Story

As a 系统用户（所有角色）,
I want 在 SKU 详情页一页查看全部产品信息，包括关联的证书、资料、FAQ、销售价格,
So that 任何角色打开同一个 SKU 就能看到与自己相关的全部信息，不用跨系统查找。

---

## Acceptance Criteria

**Given** 用户进入 SKU 详情页  
**When** 页面加载完成  
**Then** 顶部摘要区展示：SKU编码、SKU中文名称、产品状态（颜色标签）、SPU编码、供应商  
**And** 下方以 Tab 分区展示关联数据（UX-DR11）

**Given** Tab "基础信息"  
**When** 选中  
**Then** 展示 SKU 全部字段（基础信息、产品属性、特殊属性、包装信息、包装明细、报关信息、产品图片）  
**And** 继承字段标注"继承自 SPU"  
**And** 敏感字段按角色控制可见性（采购价仅产品部/财务部/管理员可见）

**Given** Tab "产品证书"  
**When** 选中  
**Then** 展示关联证书列表：该 SKU 所属 SPU 的证书 + 通用证书 + 分类匹配证书（FR13）  
**And** 证书状态标签：有效（绿）/即将过期（橙）/已过期（红）  
**And** 所有关联证书均在详情查询时按归属模型聚合命中，不写回 SKU 主表

**Given** Tab "产品资料"  
**When** 选中  
**Then** 展示关联资料列表：通用资料 + 指定该 SKU 的资料 + 该 SKU 所属分类的资料（FR13）  
**And** 资料关联结果在详情查询时动态聚合，不写回 SKU 主表

**Given** Tab "FAQ"  
**When** 选中  
**Then** 展示关联 FAQ 列表：该 SKU 所属 SPU 的 FAQ + 全局 FAQ（FR13）  
**And** FAQ 关联结果在详情查询时动态聚合，不写回 SKU 主表

**Given** Tab "销售价格"  
**When** 选中  
**Then** 展示最新已审批的区域价格表（国家/地区、销售价、列表价、币种），只读（FR13）

**Given** SKU 聚合查询性能  
**When** 加载详情页  
**Then** 全部关联数据（证书+资料+FAQ+价格）响应时间 P95 不超过 3 秒（NFR2）

---

## Scope

### In Scope

- 将 `SKUDetailPage` 从占位页升级为真实聚合详情页
- 顶部摘要展示 SKU 核心信息：SKU编码、SKU中文名称、产品状态、SPU编码、供应商
- 以 Tab 组织“基础信息 / 产品证书 / 产品资料 / FAQ / 销售价格”五个分区
- 复用 4.1 / 4.2 / 4.3 / 4.5 已有 SKU 明细与图片字段展示能力
- 复用 5.1 证书、6.1 资料、6.2 FAQ、7.1 价格接口做前端聚合筛选与只读展示
- 维持现有 KeepAlive、页签、查询缓存与详情页组织模式
- 补充前端测试，覆盖顶部摘要、Tab 切换、敏感字段可见性与四类聚合结果

### Out of Scope

- 为 4.6 新增专用后端 SKU 聚合查询接口
- 证书 / 资料 / FAQ / 价格模块自身 CRUD 扩展
- 价格审批操作页、审批流交互、历史版本对比
- 基于国家/地区的资料二次过滤深化规则，如果当前前端无用户上下文可判定，则仅展示接口已返回的资料结果
- 全局布局或通用组件的大规模重构

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-4 | done | 页签导航、KeepAlive、动态路由包装模式已可复用 |
| 1-5 | done | `FormSectionCard`、`InheritedField`、详情页展示模式已可复用 |
| 1-3 | done | `canViewPurchasePrice` 等字段级权限判断已可复用 |
| 3-4 | review（已合并到 `main`） | SPU 聚合详情页已沉淀详情页聚合、错误态与跳转模式 |
| 4-1 | done（已合并） | SKU 明细接口与继承字段镜像已可用 |
| 4-2 | done（已合并） | 报关信息字段与权限边界已落地 |
| 4-3 | done（已合并） | 产品图片能力已落地 |
| 4-4 | done | SKU 列表与 `/products/skus/:skuId` 路由入口已接通 |
| 4-5 | review（已合并到 `main`） | SKU 表单字段分区、继承字段文案与图片展示模式已收敛 |
| 5-1 | review（已合并到 `main`） | 证书列表接口已返回归属模型与状态字段 |
| 6-1 | review（已合并到 `main`） | 资料列表接口已返回归属模型、摘要、附件与国家字段 |
| 6-2 | review（已合并到 `main`） | FAQ 列表接口已支持 SPU FAQ / 全局 FAQ 模型 |
| 7-1 | review（已合并到 `main`） | 价格详情 / 列表接口已返回 SKU/SPU 快照与区域价格 |

---

## 实施任务建议

- [x] Task 1: SKU 详情聚合数据接入
  - [x] 复用 `skusApi.getById` 作为主详情数据源
  - [x] 明确证书 / 资料 / FAQ / 价格四类聚合筛选与去重规则
  - [x] 评估是否需要在 `src/types/product.ts` 增补 4.6 最小前端类型

- [x] Task 2: SKU 详情页主体结构
  - [x] 重写 `erp-frontend/src/features/products/skus/pages/SKUDetailPage.tsx`
  - [x] 实现顶部摘要区与五个 Tab 分区
  - [x] 基础信息 Tab 展示 SKU 全量字段、包装明细、报关信息、产品图片

- [x] Task 3: 聚合分区与跳转交互
  - [x] 产品证书 Tab 展示聚合证书列表，并支持跳转证书详情
  - [x] 产品资料 Tab 展示聚合资料列表，并支持跳转资料详情
  - [x] FAQ Tab 展示聚合 FAQ 列表，并支持跳转 FAQ 详情
  - [x] 销售价格 Tab 展示最新已审批价格，只读展示

- [x] Task 4: 权限、错误态与缓存一致性
  - [x] 采购价等敏感字段按角色显隐
  - [x] 关联查询失败时明确展示错误态，不伪装成“暂无数据”
  - [x] 分类 / 关联数据 / Tab 切换遵循现有 KeepAlive 与 query key 习惯

- [x] Task 5: 测试与验证
  - [x] 新增 `erp-frontend/src/test/features/SKUDetailPage.test.tsx`
  - [x] 覆盖顶部摘要、Tab 切换、采购价权限、聚合结果、详情跳转
  - [x] 跑通前端相关测试与必要构建验证

---

## Dev Notes

### 现有前端基础

- 当前占位页：`erp-frontend/src/features/products/skus/pages/SKUDetailPage.tsx`
- 路由层已经显式传入 `skuId`：
  - `App.tsx` → `RoutedSKUDetailPage`
- 当前可直接复用的成熟模式：
  - `erp-frontend/src/features/products/spus/pages/SPUDetailPage.tsx`
  - `erp-frontend/src/features/products/certificates/pages/CertificateDetailPage.tsx`
  - `erp-frontend/src/features/products/documents/pages/DocumentDetailPage.tsx`
  - `erp-frontend/src/features/products/faqs/pages/FAQDetailPage.tsx`
  - `erp-frontend/src/features/prices/pages/PriceDetailPage.tsx`

### 关键实现约束

1. 4.6 只做 SKU 聚合详情页，不反向扩展 5.x / 6.x / 7.x 各模块的管理能力
2. KeepAlive 页面不要自行依赖 `useParams()` 决定核心模式；页面组件只消费 `skuId` props
3. 页面结构遵循 UX-DR11：顶部摘要 + Tab 分区；不要退化成无层次的长页面堆叠
4. 基础信息 Tab 需覆盖 SKU 全字段，但应按“基础信息 / 产品属性 / 特殊属性 / 包装信息 / 包装明细 / 报关信息 / 产品图片”分段组织，避免可读性崩掉
5. 继承字段必须明确标注“继承自 SPU”，不要与 SKU 自有字段混淆
6. 采购价字段只能对产品部 / 财务部 / 管理员展示，商务部不可见
7. FAQ 聚合仍遵循“所属 SPU FAQ + 全局 FAQ”，不要把其他 SPU FAQ 混入
8. 价格分区只展示“最新已审批生效”的价格，不要提前把草稿 / 待审批价格混进 4.6
9. 资料聚合规则需遵循 6.1 的归属模型：通用 + 指定 SKU + 分类命中；若后续涉及 `applicable_countries`，当前 Story 只在已有信息足够判断时做过滤
10. 当前仓库尚未有 SKU 聚合专用接口，4.6 默认通过现有接口在前端做最小聚合筛选；若过程中发现接口能力缺口，再谨慎评估是否需要最小后端补口

### 推荐展示结构

- 顶部摘要区：
  - SKU编码、SKU中文名称、产品状态标签、SPU编码、供应商
  - 操作区保留“返回列表”，如角色可写则展示“编辑”
- Tab 分区：
  - 基础信息
  - 产品证书
  - 产品资料
  - FAQ
  - 销售价格

### 推荐基础信息展示重点

- 基础信息：
  - SKU编码、SKU中文名称、SKU英文名称、产品型号、产品类型、SPU编码、SPU名称
- 继承字段：
  - 一级/二级/三级分类、供应商、客户质保期、禁止经营国家
- 产品属性 / 特殊属性：
  - `core_params`、`electrical_params`、`principle`、`usage`、`material`、`has_plug`、`is_special`、`special_notes`
- 包装信息：
  - `package_type`、`package_quantity`
- 包装明细：
  - 重量、尺寸、体积等子表
- 报关信息：
  - `customs_hscode`、`customs_supervision_condition`、`customs_declaration_elements`、`customs_refund_tax_rate`、`customs_info_ready`
- 产品图片：
  - 图片缩略图 / 文件列表

### 聚合规则建议

- 证书：
  - `通用`
  - `SPU归属` 且命中当前 `sku.spu_id`
  - `按分类` 且命中当前 SKU 三级分类路径任一节点
- 资料：
  - `通用`
  - `指定SKU` 且命中当前 `sku.id`
  - `按分类` 且命中当前 SKU 分类路径
- FAQ：
  - `spu_id == sku.spu_id`
  - `spu_id == null`
- 价格：
  - 优先复用 7.1 / 7.3 已有已生效价格视图或现有 detail/list 能力
  - 若需要从多条价格记录中挑“最新已审批生效”，必须沿用现有审批状态语义，不自行发明

### References

- `_bmad-output/planning-artifacts/epics.md`（Story 4.6）
- `_bmad-output/planning-artifacts/prd-product-management.md`（SKU 详情页、FR13）
- `_bmad-output/planning-artifacts/ux-design-specification.md`（UX-DR11、聚合展示）
- `_bmad-output/planning-artifacts/architecture.md`（SKU 聚合查询性能与字段级权限）
- `_bmad-output/implementation-artifacts/3-4-spu-详情页.md`
- `_bmad-output/implementation-artifacts/4-4-sku-列表页与筛选.md`
- `_bmad-output/implementation-artifacts/4-5-sku-新增编辑表单页.md`
- `_bmad-output/implementation-artifacts/5-1-证书数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/6-1-产品资料数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/6-2-faq-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/7-1-价格数据模型与-crud-api.md`

---

## Dev Agent Record

### Debug Log

- 2026-04-23: create-story 完成，已基于 Epic 4、PRD、UX、4.4/4.5 前端结构以及 5.1 / 6.1 / 6.2 / 7.1 聚合底座生成 4.6 开发上下文
- 2026-04-23: 完成 `SKUDetailPage` 真实实现，落地顶部摘要 + 五个 Tab 分区，并复用现有详情页、页签和 KeepAlive 模式
- 2026-04-23: 基础信息 Tab 按 4.5 的字段分区顺序展示 SKU 全量字段、继承字段、包装明细、报关信息和产品图片
- 2026-04-23: 证书 / 资料 / FAQ / 价格四个聚合分区均已接入，支持前端最小聚合筛选、只读展示与详情跳转
- 2026-04-23: 新增 `SKUDetailPage` 专项测试，覆盖摘要、Tab、聚合结果、FAQ 去串线、采购价权限和价格空态；前端全量测试与构建验证通过

### Completion Notes

- 已完成 SKU 详情页真实聚合展示，实现顶部摘要与“基础信息 / 产品证书 / 产品资料 / FAQ / 销售价格”五个 Tab
- 基础信息 Tab 已覆盖 SKU 全字段，并对分类、供应商、客户质保期、禁止经营国家、采购价等继承字段使用“继承自 SPU”样式展示
- 产品证书 Tab 已展示“通用 + SPU归属 + 分类命中”聚合证书列表，并支持跳转证书详情
- 产品资料 Tab 已展示“通用 + 指定SKU + 分类命中”聚合资料列表，并支持跳转资料详情
- FAQ Tab 已展示“所属 SPU FAQ + 全局 FAQ”，并避免混入其他 SPU FAQ，同时支持跳转 FAQ 详情
- 销售价格 Tab 已复用 `getEffectiveBySku` 展示最新已生效价格；无已生效价格时展示明确空态
- 已补充分类树、SPU 继承信息、四类聚合查询的错误态处理，避免失败时伪装成空数据
- 已完成验证：`npm --prefix erp-frontend test -- src/test/features/SKUDetailPage.test.tsx` 5/5 通过，`npm --prefix erp-frontend test` 133/133 通过，`npm --prefix erp-frontend run build` 通过

### File List

- `_bmad-output/implementation-artifacts/4-6-sku-详情页.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `erp-frontend/src/features/products/skus/pages/SKUDetailPage.tsx`
- `erp-frontend/src/test/features/SKUDetailPage.test.tsx`

### Change Log

- 2026-04-23: 初始创建 Story 4.6 implementation artifact，并进入开发
- 2026-04-23: 完成 SKU 聚合详情页实现、专项测试、前端全量测试与构建验证，状态更新为 `review`
