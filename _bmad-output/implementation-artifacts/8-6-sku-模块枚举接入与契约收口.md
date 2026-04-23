# Story 8.6: SKU 模块枚举接入与契约收口

**Status:** done
**Story Key:** 8-6-sku-模块枚举接入与契约收口
**Epic:** 8 - 数据导入与系统配置
**Date:** 2026-04-23

---

## User Story

As a 产品部用户,
I want 在 SKU 模块中统一使用系统维护的产品类型、产品状态、单位、包装类型等枚举,
So that SKU 表单、列表、详情展示与枚举中心保持一致，减少跨模块字段漂移。

---

## Acceptance Criteria

**Given** `product_type`、`product_status`、`unit`、`package_type` 枚举组已配置  
**When** 用户进入 SKU 新增/编辑页  
**Then** 对应字段均以下拉方式展示统一枚举选项  
**And** 提交值为稳定枚举键，不再依赖页面硬编码选项  
**And** 禁用枚举不再出现在普通新增选择中

**Given** 用户进入 SKU 列表页  
**When** 使用产品类型或产品状态筛选  
**Then** 筛选项消费统一枚举选项  
**And** 列表展示与表单选择口径一致

**Given** 用户进入 SKU 详情页  
**When** 查看产品类型、产品状态、单位、包装类型及继承国家字段  
**Then** 页面展示解析后的统一枚举文案  
**And** 与 SPU、价格、资料等相关模块的字段口径保持一致

**Given** SKU 继承自 SPU 的禁止经营国家已保存标准编码  
**When** 用户在 SKU 新增/编辑页或详情页查看继承字段  
**Then** 展示 `country_region` 枚举文案，不再展示裸 code

---

## Scope

### In Scope

- SKU 列表页产品类型、产品状态筛选项接入枚举中心
- SKU 新增/编辑页产品类型、产品状态、单位、包装类型接入枚举中心
- SKU 新增/编辑页从 SPU 继承的禁止经营国家按 `country_region` 解析展示
- SKU 详情页产品类型、产品状态、单位、包装类型与禁止经营国家展示解析后的枚举文案
- 相关前端测试与必要的最小后端契约收口
- 保持 SKU 既有路由、KeepAlive、查询缓存、列表页与表单页布局模式不变

### Out of Scope

- 价格、资料、证书、FAQ、SPU 模块枚举接入，已由 8.4 / 8.5 完成
- 新增枚举组、重做枚举管理后台或全局枚举解析大重构
- SKU 报关流程、图片上传、价格聚合、证书 / 资料 / FAQ 聚合逻辑调整
- `electrical_params` 暂不纳入本轮：当前 SKU 实现仍为普通文本输入，虽然 8.3 已定义枚举组，但 8.6 明确目标字段为产品类型、产品状态、单位、包装类型；本轮不扩展字段语义，避免影响历史输入契约

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 4-4 / 4-5 / 4-6 | done / review（已合并到 `main`） | SKU 列表、表单、详情页已稳定 |
| 8-3 | review（已合并到 `main`） | 枚举中心 API、系统枚举组与默认种子已完成 |
| 8-4 | review（已合并到 `main`） | `useSystemEnums`、业务页启用枚举读取与详情 label 解析模式已沉淀 |
| 8-5 | review（已合并到 `main`） | `country_region` 在 SPU 禁止经营国家中的标准 code 契约与一次性迁移已完成 |

---

## 实施任务

- [x] Task 1: Story 契约与范围边界
  - [x] 从最新 `main` 创建分支 `codex/8-6-sku-enum-contract`
  - [x] 创建 8.6 implementation artifact
  - [x] 明确仅覆盖 SKU 模块，不扩展到 8.4 / 8.5 或其他 Epic
  - [x] 判断 `electrical_params` 是否纳入：本轮不改电气参数输入契约

- [x] Task 2: SKU 列表页接入 `product_type` 与 `product_status`
  - [x] 筛选项消费 `useSystemEnumItems('product_type')` 与 `useSystemEnumItems('product_status')`
  - [x] 移除页面静态产品类型 / 产品状态选项依赖
  - [x] 列表产品状态展示使用枚举文案，颜色逻辑保持按稳定 key 映射

- [x] Task 3: SKU 新增/编辑页接入枚举
  - [x] 产品类型消费 `product_type`
  - [x] 产品状态消费 `product_status`
  - [x] 单位消费 `unit`
  - [x] 包装类型消费 `package_type`
  - [x] 编辑态兼容详情已有历史值回显，但不让禁用值进入普通新增选择
  - [x] 继承字段中的禁止经营国家消费 `country_region` 文案展示

- [x] Task 4: SKU 详情页展示收口
  - [x] 产品类型展示解析后的枚举文案
  - [x] 产品状态展示解析后的枚举文案
  - [x] 单位展示解析后的枚举文案
  - [x] 包装类型展示解析后的枚举文案
  - [x] 禁止经营国家展示 `country_region` 文案

- [x] Task 5: 测试与验证
  - [x] 补充 / 调整 SKU 列表页枚举接入前端测试
  - [x] 补充 / 调整 SKU 表单页枚举接入前端测试
  - [x] 补充 / 调整 SKU 详情页枚举展示前端测试
  - [x] 跑通相关前端测试、前端构建和可执行后端测试 / lint 中可运行部分

### Review Findings

- [x] [Review][Patch] 新增 SKU 表单仍硬编码默认产品状态 `上架`，当该枚举被禁用时仍会作为新增提交值 [erp-frontend/src/features/products/skus/pages/SKUFormPage.tsx:83]
- [x] [Review][Patch] SKU 后端产品类型 / 产品状态仅放开为任意字符串，没有校验是否为枚举中心稳定 key [erp-backend/app/schemas/sku.py:32]

---

## Dev Notes

### 关键实现约束

1. 继续复用 `erp-frontend/src/hooks/useSystemEnums.ts`，查询 key 使用 `['system-enums', group, 'enabled']`
2. 普通业务选择只读取启用枚举：`include_disabled: false`
3. 编辑态若已有历史值不在启用枚举中，应通过 `buildEnumOptions(..., extraOptions)` 兼容回显，但不让禁用值进入普通新增选择
4. SKU `restricted_countries` 已由 8.5 的一次性迁移清洗为标准 code，本轮不维护自由文本国家名兼容
5. 国家/地区展示使用 `resolveEnumLabel()`，找不到枚举时回退原 code，避免异常空白
6. 列表页保持紧凑内容区和现有 `FilterCard` / `PaginationBar` 模式，不额外展示页面标题
7. 表单页保持三列表单布局、`FormSectionCard`、`FormGrid`、`FixedActionBar` 与当前缓存刷新模式
8. 路由层继续显式传入 `mode` 与 `id`，页面不自行依赖 `useParams()` 决定核心模式
9. 不重构通用组件、不改全局布局、不扩大到 Story 8.3 的其他枚举组

### 后端契约说明

- 当前 SKU `product_type` 与 `product_status` 后端 Schema 仍是固定枚举，8.6 的主要目标是前端业务页从枚举中心读取选项与展示文案。
- 如实现过程中发现后端固定枚举阻碍已配置枚举键的提交，应做最小契约收口；但不要引入运行期长期双轨逻辑。
- `unit` 与 `package_type` 后端当前为字符串字段，本轮不改数据库结构。
- `restricted_countries` 已由 8.5 标准化为 `country_region` code，本轮只做 SKU 侧展示解析。

### References

- `_bmad-output/planning-artifacts/epics.md`（Story 8.6）
- `_bmad-output/planning-artifacts/prd-product-management.md`（SKU 管理）
- `_bmad-output/planning-artifacts/architecture.md`（SKU 模块结构）
- `_bmad-output/implementation-artifacts/8-3-枚举值配置管理.md`
- `_bmad-output/implementation-artifacts/8-4-价格与资料模块枚举接入.md`
- `_bmad-output/implementation-artifacts/8-5-证书-faq-与-spu-模块枚举接入.md`

---

## Dev Agent Record

### Debug Log

- 2026-04-23: 确认本地 `main` 与 `origin/main` 均为 `2a28e2091ee0f81d6f52a2b9712e7e4096a21303`
- 2026-04-23: 从最新 `main` 切出分支 `codex/8-6-sku-enum-contract`
- 2026-04-23: 创建 Story 8.6 implementation artifact，并进入开发
- 2026-04-23: 完成 SKU 列表页产品状态 / 产品类型筛选接入枚举中心，并移除页面静态筛选选项
- 2026-04-23: 完成 SKU 表单页产品类型、产品状态、单位、包装类型接入枚举中心；编辑态通过当前详情值做回显兜底
- 2026-04-23: 完成 SKU 表单与详情页禁止经营国家 `country_region` 文案解析，详情页产品类型 / 状态 / 单位 / 包装类型展示解析后的枚举文案
- 2026-04-23: 8.6 相关前端测试通过，`npm --prefix erp-frontend test -- src/test/features/SKUListPage.test.tsx src/test/features/SKUFormPage.test.tsx src/test/features/SKUDetailPage.test.tsx` 27/27 通过
- 2026-04-23: 前端构建通过，`npm --prefix erp-frontend run build` 通过，仅保留 Vite 大 chunk 提示
- 2026-04-23: 后端全量回归通过，`bash scripts/backend-test.sh` 169/169 通过
- 2026-04-23: `npm --prefix erp-frontend run lint` 当前不可执行，仓库缺少 `eslint` 可执行依赖，脚本直接报 `eslint: command not found`
- 2026-04-23: 增加 SKU 后端最小契约收口，`product_type` / `product_status` 接收枚举中心新增字符串 key，列表筛选同步放开固定枚举限制
- 2026-04-23: 后端全量回归重新通过，`bash scripts/backend-test.sh` 170/170 通过
- 2026-04-23: Code review 发现 2 个需要修复的枚举契约问题，已记录到 Review Findings，Story 状态退回 `in-progress`
- 2026-04-23: 修复 Review Finding 1：新增 SKU 表单默认产品状态仅在启用枚举包含 `上架` 时自动补入，否则保持空值并触发表单必选校验
- 2026-04-23: 修复 Review Finding 2：SKU 后端 create / update / list filter 对 `product_type`、`product_status` 校验启用枚举 key
- 2026-04-23: 8.6 相关前端测试重新通过，`npm --prefix erp-frontend test -- src/test/features/SKUFormPage.test.tsx src/test/features/SKUListPage.test.tsx src/test/features/SKUDetailPage.test.tsx` 28/28 通过
- 2026-04-23: 前端构建重新通过，`npm --prefix erp-frontend run build` 通过，仅保留 Vite 大 chunk 提示
- 2026-04-23: 后端全量回归重新通过，`bash scripts/backend-test.sh` 171/171 通过
- 2026-04-23: Code review 复核完成，未发现新的 decision / patch / defer findings
- 2026-04-23: Review 收口验证通过：8.6 相关前端测试 28/28 通过，前端构建通过（仅保留 Vite 大 chunk 提示），后端全量回归 171/171 通过

### Completion Notes

- 已完成 SKU 列表页 `product_type`、`product_status` 筛选项枚举中心接入，普通业务选择仅读取启用枚举。
- 已完成 SKU 新增/编辑页 `product_type`、`product_status`、`unit`、`package_type` 枚举中心接入，并保留编辑态历史值回显兜底。
- 已完成 SKU 详情页产品类型、产品状态、单位、包装类型展示文案解析，产品状态颜色仍按稳定 key 映射。
- 已完成 SKU 表单和详情页继承字段 `restricted_countries` 的 `country_region` 文案解析，不再展示裸国家 code。
- 本轮未纳入 `electrical_params`：当前 SKU 实现为普通文本输入，8.6 目标字段已覆盖产品类型、产品状态、单位、包装类型；避免扩展字段语义影响历史输入。
- 已完成 SKU 后端最小契约收口：`product_type` / `product_status` 写入、响应与列表筛选从固定 Pydantic Enum 放开为字符串，以匹配枚举中心新增键；默认产品状态仍保持“上架”。
- 已修复 code review 发现的新增态默认值问题：`上架` 只有仍在启用枚举选项中时才作为默认值，否则新增表单保持未选。
- 已修复 code review 发现的后端任意字符串问题：SKU create / update / list filter 均校验 `product_type`、`product_status` 为启用枚举 key。
- `restricted_countries` 标准 code 收口已由 8.5 迁移完成，本轮只做 SKU 侧展示解析。
- 已保持 SKU 既有路由、KeepAlive、查询缓存、列表页和表单页布局模式不变。
- 本轮 code review 已完成，未发现新的阻塞问题，Story 状态更新为 `done`。
- 残余风险：当前仓库 `lint` 脚本仍缺少 `eslint` 可执行依赖，本 Story 未额外修复该环境问题。

### File List

- `_bmad-output/implementation-artifacts/8-6-sku-模块枚举接入与契约收口.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `erp-backend/app/routers/skus.py`
- `erp-backend/app/schemas/sku.py`
- `erp-backend/app/services/skus.py`
- `erp-backend/tests/routers/test_prices.py`
- `erp-backend/tests/routers/test_product_documents.py`
- `erp-backend/tests/routers/test_skus.py`
- `erp-backend/tests/routers/test_spus.py`
- `erp-frontend/src/features/products/skus/pages/SKUListPage.tsx`
- `erp-frontend/src/features/products/skus/pages/SKUFormPage.tsx`
- `erp-frontend/src/features/products/skus/pages/SKUDetailPage.tsx`
- `erp-frontend/src/hooks/useSystemEnums.ts`
- `erp-frontend/src/types/product.ts`
- `erp-frontend/src/test/features/SKUListPage.test.tsx`
- `erp-frontend/src/test/features/SKUFormPage.test.tsx`
- `erp-frontend/src/test/features/SKUDetailPage.test.tsx`

### Change Log

- 2026-04-23: 初始创建 Story 8.6 implementation artifact，并进入开发
- 2026-04-23: 完成 SKU 模块枚举接入与展示契约收口、相关测试与验证，并将 Story 状态更新为 `review`
- 2026-04-23: 补充 SKU 后端 `product_type` / `product_status` 字符串契约收口与回归测试
- 2026-04-23: Code review 记录 2 个 patch findings，Story 状态退回 `in-progress`
- 2026-04-23: 修复 2 个 code review findings，补充测试并将 Story 状态恢复为 `review`
