# Story 8.1: Excel 导入模板与批量导入 API

**Status:** review
**Story Key:** 8-1-excel-导入模板与批量导入-api
**Epic:** 8 - 数据导入与系统配置
**Date:** 2026-04-24

---

## User Story

As a 管理员,
I want 下载标准导入模板并通过 Excel 批量导入分类、SPU、SKU 历史数据,
So that 系统上线时可以快速完成历史数据迁移。

---

## Acceptance Criteria

**Given** 管理员调用 `GET /api/v1/import/templates/{type}` （type = categories/spus/skus）
**When** 下载导入模板
**Then** 返回标准 Excel 模板文件，含字段名和填写说明（FR28）

**Given** 管理员上传填写好的 Excel 文件
**When** 调用 `POST /api/v1/import/{type}`
**Then** 系统执行校验：格式、必填项、唯一性（编码不重复）、关联有效性（分类/供应商必须已存在）（FR30）
**And** 返回校验结果：成功条数 / 失败条数 / 失败原因明细（逐行）

**Given** 校验结果中有失败记录
**When** 管理员修正数据后重新上传
**Then** 系统重新校验，支持反复修正直到通过（FR31）

**Given** 校验全部通过后确认导入
**When** 调用确认导入 API
**Then** 数据写入数据库，返回最终导入成功条数

**Given** 单次导入 1000 条数据
**When** 执行导入
**Then** 处理时间不超过 30 秒（NFR3）
**And** 超过时提供进度反馈

---

## Scope

### In Scope

- 分类 / SPU / SKU 三类 Excel 模板下载接口
- 分类 / SPU / SKU 三类 Excel 上传校验接口
- 校验结果返回结构设计：成功数、失败数、逐行错误明细
- 校验通过后的确认导入接口与数据库写入
- 最小可行的导入进度反馈能力
- 相关后端测试、权限校验与模板样例约束

### Out of Scope

- 8.2 的导入前端页面与交互
- 枚举管理与业务页枚举接入
- 非 Excel 的 CSV/Zip/异步任务平台化扩展
- 上线后大规模历史任务留痕后台、任务列表页与任务重试中心

---

## 实施任务

- [x] Task 1: 现有数据模型与导入字段契约梳理
  - [x] 明确分类 / SPU / SKU 模板字段、必填项、关联字段与允许空值策略
  - [x] 明确模板列名、说明行与导入值格式
  - [x] 明确分类层级、供应商、枚举字段在导入中的收口策略

- [x] Task 2: 模板下载 API
  - [x] 实现 `GET /api/v1/import/templates/{type}`
  - [x] 生成可下载 Excel 模板
  - [x] 为三类模板补充后端测试

- [x] Task 3: 上传校验 API
  - [x] 实现 `POST /api/v1/import/{type}` 解析 Excel
  - [x] 实现格式、必填、唯一性、关联有效性校验
  - [x] 返回逐行校验结果

- [x] Task 4: 确认导入 API
  - [x] 设计校验结果与确认导入之间的载体
  - [x] 实现校验通过后的写库逻辑
  - [x] 保证重复上传 / 重复确认的幂等边界清晰

- [x] Task 5: 测试与验证
  - [x] 补充分类 / SPU / SKU 导入 API 测试
  - [x] 验证权限控制与错误返回格式
  - [x] 评估 1000 行导入性能与进度反馈策略

---

## Dev Notes

### 当前已知上下文

1. Epic 8 的后续 8.2 会消费本 Story 的模板下载、上传校验、确认导入能力。
2. 架构文档将数据导入映射到后端 `app/*/import_tasks.*`、前端 `features/products/import/`。
3. 当前前端导入页仍为占位页，8.1 可以先独立完成后端能力。
4. 数据导入权限按 PRD 仅管理员与产品部可操作，但 Story 文案主体是管理员，需在实现时结合现有权限常量核对最终口径。
5. 需要优先明确模板字段契约，否则 8.1 和 8.2 都会反复返工。
6. 当前系统没有独立供应商主数据表，因此本轮将“供应商必须已存在”的执行口径收口为：SPU 导入时供应商名称必须已存在于系统既有 SPU 供应商集合中；SKU 导入通过所属 SPU 继承供应商。

### 待优先确认的风险点

1. SKU 导入字段跨度最大，覆盖基础信息、产品属性、包装信息、报关信息，需决定首版是否单 Sheet 全量导入。
2. SPU / SKU 导入中的“供应商必须已存在”依赖现有主数据契约，但仓库当前未见独立供应商主数据模块，需确认以名称校验还是引用现有字段。
3. “校验后确认导入”意味着需要中间态载体，需判断走缓存、临时表还是签名 payload。
4. 1000 行 30 秒和“超过时给进度反馈”可能意味着同步校验 + 异步写库的折中设计。

### Review Findings

- [x] [Review][Patch] SPU 导入校验补充“供应商必须已存在”的可执行口径，避免未受控供应商名称被直接导入
- [x] [Review][Patch] 确认导入的进度状态改为独立事务持久化，保证轮询接口可观察到 `importing` 中间态
- [x] [Review][Patch] `failed_count` 改为按失败记录统计，而不是按逐字段错误条数统计
- [x] [Review][Patch] 调整确认导入的任务状态提交时序，避免 MySQL 在进度更新与主事务并发更新同一任务行时出现锁等待超时

### References

- `_bmad-output/planning-artifacts/epics.md`（Story 8.1 / 8.2）
- `_bmad-output/planning-artifacts/prd-product-management.md`（数据导入章节）
- `_bmad-output/planning-artifacts/architecture.md`（数据导入映射与模块边界）

---

## Dev Agent Record

### Debug Log

- 2026-04-24: 从 `main` 切出分支 `codex/8-1-excel-import-api`
- 2026-04-24: 创建 Story 8.1 implementation artifact，并进入开发
- 2026-04-24: 新增 `import_tasks` 模型、仓储、Schema、Service、Router，提供模板下载、上传校验、确认导入与任务进度 API
- 2026-04-24: 新增分类 / SPU / SKU 三类 Excel 模板定义与说明页生成逻辑
- 2026-04-24: 实现分类导入层级校验、SPU 多行开票信息聚合校验、SKU 多行包装明细聚合校验与报关信息导入
- 2026-04-24: 新增导入 API 测试并通过后端全量回归，`bash scripts/backend-test.sh` 177/177 通过
- 2026-04-24: 修复 code review findings：补充供应商已存在校验、导入中间进度持久化与失败记录计数修正
- 2026-04-24: 修复 8.1 后端 CI `Lock wait timeout exceeded`，将 `importing` 起始状态完全交由独立事务持久化，并避免主事务与进度更新并发写同一 `import_tasks` 行
- 2026-04-24: 修复后端全量回归重新通过，`bash scripts/backend-test.sh` 180/180 通过
- 2026-04-24: 修复 CI 锁等待问题后再次完成后端全量回归，`bash scripts/backend-test.sh` 183/183 通过

### Completion Notes

- 已实现 `GET /api/v1/import/templates/{type}`，返回分类 / SPU / SKU 三类标准 Excel 模板。
- 已实现 `POST /api/v1/import/{type}`，支持解析 `.xlsx`、执行格式/必填/唯一性/关联有效性校验，并返回逐行错误明细。
- 已实现 `POST /api/v1/import/{type}/confirm`，通过 `import_tasks` 中间态载体承接“校验后确认导入”流程。
- 已实现 `GET /api/v1/import/tasks/{task_id}`，为 8.2 前端页面预留任务状态与进度查询接口。
- 已复用现有分类 / SPU / SKU Service 完成最终写库，避免导入路径绕开现有业务约束。
- 已补充分类 / SPU / SKU 导入核心测试，以及模板下载和权限测试。
- 当前导入任务状态会在确认导入期间通过独立事务更新，轮询接口可观察到 `importing` 中间态；若后续真实数据量继续增长，仍建议进一步演进为真正异步任务执行。
- 为兼容 CI 使用的 MySQL 行锁语义，确认导入只在开始阶段通过独立事务写入 `importing`，最终 `imported` 状态仍跟随主事务提交，避免进度更新与主事务写同一任务行导致锁等待超时。
- 当前系统缺少独立供应商主数据模型，因此本轮将“供应商必须已存在”收口为“必须存在于既有 SPU 供应商集合中”；若后续补齐供应商主数据模块，应再升级为引用主数据校验。

### File List

- `_bmad-output/implementation-artifacts/8-1-excel-导入模板与批量导入-api.md`
- `_bmad-output/implementation-artifacts/epic-8-context.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `erp-backend/alembic/versions/0015_create_import_tasks_table.py`
- `erp-backend/app/models/import_task.py`
- `erp-backend/app/repositories/import_tasks.py`
- `erp-backend/app/schemas/import_tasks.py`
- `erp-backend/app/services/import_tasks.py`
- `erp-backend/app/routers/import_tasks.py`
- `erp-backend/tests/routers/test_import_tasks.py`
- `erp-backend/requirements.txt`
- `erp-backend/app/models/__init__.py`
- `erp-backend/app/main.py`
