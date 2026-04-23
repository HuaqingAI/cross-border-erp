# Story 8.5: 证书、FAQ 与 SPU 模块枚举接入

**Status:** review
**Story Key:** 8-5-证书-faq-与-spu-模块枚举接入
**Epic:** 8 - 数据导入与系统配置
**Date:** 2026-04-23

---

## User Story

As a 产品部用户,
I want 在证书、FAQ 与 SPU 模块中使用统一维护的证书类型、问题类型、单位与国家/地区枚举,
So that 主数据字段口径一致，避免各页面分别维护常量。

---

## Acceptance Criteria

**Given** `certificate_type` 枚举组已配置  
**When** 用户进入证书列表页、证书新增/编辑页或证书详情页  
**Then** 证书类型筛选、表单字段与展示文案均消费统一枚举选项  
**And** 禁用的证书类型不再出现在普通业务选择中

**Given** `faq_question_type` 枚举组已配置  
**When** 用户进入 FAQ 列表页、FAQ 新增/编辑页或 FAQ 详情页  
**Then** 问题类型筛选、表单字段与展示文案均消费统一枚举选项  
**And** 禁用的问题类型不再出现在普通业务选择中

**Given** `unit` 与 `country_region` 枚举组已配置  
**When** 用户进入 SPU 新增/编辑页  
**Then** 单位字段使用统一枚举选项  
**And** 禁止经营国家字段以下拉多选方式展示并提交标准编码  
**And** 禁用的单位和国家/地区不再出现在普通业务选择中

**Given** SPU 已保存禁止经营国家标准编码  
**When** 用户进入 SPU 详情页  
**Then** 禁止经营国家展示解析后的国家/地区文案，而不是裸 code

---

## Scope

### In Scope

- 证书列表页 / 表单页 / 详情页接入 `certificate_type`
- FAQ 列表页 / 表单页 / 详情页接入 `faq_question_type`
- SPU 新增/编辑页接入 `unit` 与 `country_region`
- SPU 详情页解析 `country_region` 展示文案
- 相关前端测试与最小后端契约收口
- 保持现有证书、FAQ、SPU 模块结构、路由、缓存与 KeepAlive 模式

### Out of Scope

- 价格与资料模块枚举接入（已由 Story 8.4 完成）
- SKU 模块枚举接入与详情展示收口（Story 8.6）
- 新增枚举组、重做枚举管理后台或全局布局
- 证书到期预警、FAQ 附件上传、SPU 供应商业务规则等既有功能重构

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 5-1 / 5-3 | review（已合并到 `main`） | 证书后端与前端页面已稳定 |
| 6-2 / 6-3 | review（已合并到 `main`） | FAQ 后端与前端页面已稳定 |
| 3-1 / 3-3 / 3-4 | review（已合并到 `main`） | SPU CRUD、表单与详情页已稳定 |
| 8-3 | review（已合并到 `main`） | 枚举中心 API、缓存 key 与系统枚举组已完成 |
| 8-4 | review（已合并到 `main`） | `useSystemEnums`、业务页枚举读取和 code -> label 展示模式已沉淀 |

---

## 实施任务

- [x] Task 1: Story 契约与范围边界
  - [x] 从最新 `main` 创建分支 `codex/8-5-enum-integration-cert-faq-spu`
  - [x] 创建 8.5 implementation artifact
  - [x] 明确仅覆盖证书、FAQ 与 SPU，不扩展到 SKU 或 8.4 已完成范围
  - [x] 判断 `invoice_unit`：基于 8.3 枚举组说明“SPU、SKU 与开票等场景复用的计量单位”，本轮仅在 SPU 表单中复用 `unit` 下拉；不改后端字段结构，不扩展到其他开票场景

- [x] Task 2: 证书模块接入 `certificate_type`
  - [x] 证书列表页筛选项消费 `useSystemEnumItems('certificate_type')`
  - [x] 证书表单页证书类型消费 `certificate_type`，编辑态兼容当前详情已有值
  - [x] 证书列表与详情展示解析后的枚举文案
  - [x] 删除页面内静态证书类型常量依赖

- [x] Task 3: FAQ 模块接入 `faq_question_type`
  - [x] FAQ 列表页筛选项消费 `useSystemEnumItems('faq_question_type')`
  - [x] FAQ 表单页问题类型消费 `faq_question_type`，编辑态兼容当前详情已有值
  - [x] FAQ 列表与详情展示解析后的枚举文案
  - [x] 删除页面内静态问题类型常量依赖

- [x] Task 4: SPU 模块接入 `unit` 与 `country_region`
  - [x] SPU 新增/编辑页单位字段消费 `unit`
  - [x] SPU 新增/编辑页开票单位复用 `unit` 下拉，保持提交值仍为字符串
  - [x] SPU 新增/编辑页禁止经营国家消费 `country_region` 多选并提交标准编码
  - [x] SPU 详情页将禁止经营国家 code 解析为枚举文案
  - [x] 后端最小收口：SPU `restricted_countries` 大写、去重并校验标准编码

- [x] Task 5: 测试与验证
  - [x] 补充 / 调整证书枚举接入前端测试
  - [x] 补充 / 调整 FAQ 枚举接入前端测试
  - [x] 补充 / 调整 SPU 表单与详情枚举接入前端测试
  - [x] 补充 SPU 国家/地区标准编码后端测试
  - [x] 跑通相关前端测试、前端构建和可执行后端测试

---

## Dev Notes

### 关键实现约束

1. 继续复用 8.4 新增的 `erp-frontend/src/hooks/useSystemEnums.ts`，查询 key 使用 `['system-enums', group, 'enabled']`
2. 普通业务选择只读取启用枚举：`include_disabled: false`
3. 编辑态若已有历史值不在启用枚举中，应通过 `buildEnumOptions(..., extraOptions)` 兼容回显，但不让禁用值进入普通新增选择
4. 国家/地区字段提交标准编码，如 `CN`、`US`、`GLOBAL`；SPU 禁止经营国家不应继续使用自由文本 tag 输入
5. 详情页展示应使用 `resolveEnumLabel()`，找不到枚举时可回退原值，避免旧数据直接空白
6. 保持页面紧凑内容区和现有 `FilterCard`、`FormSectionCard`、`PaginationBar`、`FixedActionBar` 使用方式
7. 路由层继续显式传入 `mode` 与 `id`，页面不自行依赖 `useParams()` 决定核心业务模式
8. 不重构通用组件、不改全局布局、不扩大到 Story 8.6 的 SKU 单位/产品类型/包装类型等字段

### 后端契约说明

- 证书类型与 FAQ 问题类型当前后端字段为字符串，Story 8.5 以前端统一选择与展示为主，不强制后端依赖枚举表做存在性校验，避免旧数据与禁用枚举双轨维护。
- SPU `restricted_countries` 属于国家/地区标准编码字段，参考 8.4 产品资料处理方式，在服务层进行大写、去重与标准编码校验，避免继续保存自由文本国家名称。
- `invoice_unit` 仍保持字符串字段；本轮仅前端选择项复用 `unit` 枚举，不改变后端模型、Schema 或数据库结构。

### References

- `_bmad-output/planning-artifacts/epics.md`（Story 8.5）
- `_bmad-output/planning-artifacts/prd-product-management.md`（SPU 管理、产品证书管理、FAQ 管理、枚举值定义）
- `_bmad-output/planning-artifacts/architecture.md`（枚举管理补充约束、模块结构）
- `_bmad-output/implementation-artifacts/8-3-枚举值配置管理.md`
- `_bmad-output/implementation-artifacts/8-4-价格与资料模块枚举接入.md`

---

## Dev Agent Record

### Debug Log

- 2026-04-23: 确认本地 `main` 已快进到 `origin/main`，HEAD 为 `dcffd96`（PR #33 合并提交）
- 2026-04-23: 从最新 `main` 切出分支 `codex/8-5-enum-integration-cert-faq-spu`
- 2026-04-23: 创建 Story 8.5 implementation artifact，并进入开发
- 2026-04-23: 完成证书列表 / 表单 / 详情对 `certificate_type` 的枚举接入，并移除页面静态证书类型选项
- 2026-04-23: 完成 FAQ 列表 / 表单 / 详情对 `faq_question_type` 的枚举接入，并移除页面静态问题类型选项
- 2026-04-23: 完成 SPU 表单 `unit`、`country_region` 接入；开票单位谨慎复用 `unit` 下拉但不改变后端字段结构
- 2026-04-23: 完成 SPU 详情页国家/地区 code -> label 展示，并同步解析关联证书 / FAQ 表格中的类型文案
- 2026-04-23: 为 SPU `restricted_countries` 后端增加标准编码规范化、去重与校验，新增路由测试覆盖大小写、去重和非法编码
- 2026-04-23: 8.5 相关前端测试通过，`npm --prefix erp-frontend test -- src/test/features/CertificateListPage.test.tsx src/test/features/CertificateFormPage.test.tsx src/test/features/FAQListPage.test.tsx src/test/features/FAQFormPage.test.tsx src/test/features/FAQDetailPage.test.tsx src/test/features/SPUFormPage.test.tsx src/test/features/SPUDetailPage.test.tsx` 31/31 通过
- 2026-04-23: 前端构建通过，`npm --prefix erp-frontend run build` 通过，仅保留 Vite 大 chunk 提示
- 2026-04-23: 后端全量回归通过，`bash scripts/backend-test.sh` 169/169 通过
- 2026-04-23: `npm --prefix erp-frontend run lint` 当前不可执行，仓库缺少 `eslint` 可执行依赖，脚本直接报 `eslint: command not found`
- 2026-04-23: 根据 code review 处理旧 SPU/SKU 禁止经营国家历史值风险，新增一次性迁移 `0014` 清洗 `restricted_countries` 为标准 code，无法识别的旧值直接丢弃

### Completion Notes

- 已完成证书模块 `certificate_type` 枚举接入，列表筛选、表格展示、表单选择和详情展示统一消费枚举中心。
- 已完成 FAQ 模块 `faq_question_type` 枚举接入，列表筛选、表格展示、表单选择和详情展示统一消费枚举中心。
- 已完成 SPU 新增/编辑页单位、开票单位、禁止经营国家的枚举接入，普通业务选择仅读取启用枚举。
- 已完成 SPU 详情页禁止经营国家展示解析后的枚举文案，避免直接展示 `IR`、`KP` 等裸 code。
- 已为 SPU `restricted_countries` 增加后端标准编码收口，统一大写、去重并拒绝自由文本国家名称。
- 已补充一次性 Alembic 迁移清洗 SPU/SKU 既有 `restricted_countries`，不引入运行期旧数据双轨兼容。
- 已保持证书、FAQ、SPU 既有路由、缓存、KeepAlive、列表页与表单页布局模式不变。
- 本轮按用户要求未执行 code review，状态置为 `review` 表示实现完成、等待后续审查。
- 残余风险：当前仓库 `lint` 脚本仍缺少 `eslint` 可执行依赖，本 Story 未额外修复该环境问题。

### File List

- `_bmad-output/implementation-artifacts/8-5-证书-faq-与-spu-模块枚举接入.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `erp-backend/alembic/versions/0014_normalize_restricted_country_codes.py`
- `erp-backend/app/services/spus.py`
- `erp-backend/tests/routers/test_spus.py`
- `erp-frontend/src/features/products/certificates/pages/CertificateDetailPage.tsx`
- `erp-frontend/src/features/products/certificates/pages/CertificateFormPage.tsx`
- `erp-frontend/src/features/products/certificates/pages/CertificateListPage.tsx`
- `erp-frontend/src/features/products/faqs/pages/FAQDetailPage.tsx`
- `erp-frontend/src/features/products/faqs/pages/FAQFormPage.tsx`
- `erp-frontend/src/features/products/faqs/pages/FAQListPage.tsx`
- `erp-frontend/src/features/products/spus/pages/SPUDetailPage.tsx`
- `erp-frontend/src/features/products/spus/pages/SPUFormPage.tsx`
- `erp-frontend/src/test/features/CertificateFormPage.test.tsx`
- `erp-frontend/src/test/features/CertificateListPage.test.tsx`
- `erp-frontend/src/test/features/FAQDetailPage.test.tsx`
- `erp-frontend/src/test/features/FAQListPage.test.tsx`
- `erp-frontend/src/test/features/SPUDetailPage.test.tsx`
- `erp-frontend/src/test/features/SPUFormPage.test.tsx`

### Change Log

- 2026-04-23: 初始创建 Story 8.5 implementation artifact，并进入开发
- 2026-04-23: 完成证书、FAQ 与 SPU 模块枚举接入、相关测试与验证，并将 Story 状态更新为 `review`
- 2026-04-23: 处理 code review 发现的旧禁止经营国家值迁移缺口
