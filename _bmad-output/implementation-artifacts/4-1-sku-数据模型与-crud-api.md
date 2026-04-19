# Story 4.1: SKU 数据模型与 CRUD API

**Status:** review
**Story Key:** 4-1-sku-数据模型与-crud-api
**Epic:** 4 - SKU 完整管理
**Date:** 2026-04-17

---

## User Story

As a 产品部用户,
I want 创建和编辑 SKU，选择 SPU 后自动继承分类、供应商、禁止经营国家,
So that 每个规格变体的数据完整且与 SPU 保持一致。

---

## Acceptance Criteria

**Given** `skus` 表及 `sku_package_details` 子表已创建（含基础信息、产品属性、特殊属性、包装信息、报关信息全部字段）  
**When** 产品部用户调用 `POST /api/v1/skus` 创建 SKU 并指定 `spu_id`  
**Then** SKU 创建成功，自动继承 SPU 的一级/二级/三级分类、供应商、禁止经营国家（FR9）  
**And** SKU 编码全局唯一（FR10）  
**And** 产品状态默认"上架"

**Given** SKU 已创建  
**When** 尝试修改 SKU 编码  
**Then** 返回 400 错误：`"SKU编码创建后不可修改"`（FR10）

**Given** SKU 的客户质保期字段  
**When** 创建或编辑 SKU 时读取继承字段  
**Then** 始终展示当前由 SPU 下发并同步到 SKU 的客户质保期值  
**And** SKU 侧不可单独修改该字段

**Given** 产品部用户查询 SKU 列表  
**When** 传入筛选参数（分类、供应商、产品状态、产品类型、关键词）  
**Then** 返回匹配的分页 SKU 列表（FR32, FR33）  
**And** 关键词支持 SKU编码/中文名称/英文名称模糊匹配

**Given** SKU 创建时包含包装明细  
**When** 提交包装明细子表数据（净重/毛重/长/宽/高/体积）  
**Then** 包装明细记录与 SKU 关联保存

---

## Scope

### In Scope

- SKU 主表与包装明细子表的后端模型、迁移与 5-file backend 结构
- `POST /api/v1/skus`、`GET /api/v1/skus`、`GET /api/v1/skus/{id}`、`PATCH /api/v1/skus/{id}` 四类接口
- 基于 SPU 的继承逻辑：分类、供应商、禁止经营国家、客户质保期只读继承
- 产品状态默认值、SKU 编码唯一性与不可修改约束
- 列表分页、分类/供应商/产品状态/产品类型/关键词筛选
- 包装明细子表读写与顺序稳定输出
- 最小可用后端测试：创建成功、继承逻辑、唯一性、不可修改、筛选、权限、包装明细

### Out of Scope

- SKU 报关信息专属维护接口 → Story 4.2
- SKU 产品图片上传 → Story 4.3
- SKU 列表前端页面 → Story 4.4
- SKU 新增/编辑表单页 → Story 4.5
- SKU 详情页聚合展示 → Story 4.6
- SKU 状态字段保留在当前契约中，当前版本不再拆分独立 Story 4.7
- SKU 删除接口
- SPU 远程搜索前端交互、页签缓存、表单编排

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-1 | done | FastAPI / SQLAlchemy / Alembic / Docker 基础设施已就绪 |
| 1-2 | done | 登录鉴权、Cookie 认证、`get_current_user` 已可用 |
| 1-3 | done | `require_product_or_admin`、字段级权限辅助函数已可复用 |
| 2-1 | done | 分类三级树与删除保护已实现，可复用分类链路校验 |
| 3-1 | done | SPU 数据模型与 CRUD API 已实现，是 SKU 继承源 |
| 3-2 | done | SPU 列表筛选口径已落地，可复用分页与过滤模式 |
| 3-3 | done | SPU 表单约束已确认，为后续 SKU 表单提供字段契约参考 |

---

## 实施任务建议

- [x] Task 1: SKU 数据模型与迁移
  - [x] 新增 `erp-backend/app/models/sku.py`，在同一文件中定义 `SKU` 与 `SKUPackageDetail`
  - [x] 在 `erp-backend/app/models/__init__.py` 注册新模型
  - [x] 新增 Alembic migration，创建 `skus` 与 `sku_package_details` 表、索引与外键
  - [x] 一次性建好 4.1 所需基础字段，并为 4.2 / 4.4 / 4.5 / 4.6 预留稳定字段命名
  - [x] 明确报关字段只建模、不在 4.1 产品部 CRUD 中开放编辑

- [x] Task 2: SKU 模块后端结构
  - [x] 新增 `erp-backend/app/schemas/sku.py`
  - [x] 新增 `erp-backend/app/repositories/skus.py`
  - [x] 新增 `erp-backend/app/services/skus.py`
  - [x] 新增 `erp-backend/app/routers/skus.py`
  - [x] 在 `erp-backend/app/main.py` 注册 router

- [x] Task 3: 核心业务规则与继承逻辑
  - [x] 实现 SKU 编码全局唯一校验
  - [x] 实现 SKU 编码创建后不可修改
  - [x] 实现 `spu_id` 关联校验，并统一从 SPU 继承分类、供应商、禁止经营国家
  - [x] 实现客户质保期只读继承，不允许 SKU 单独修改
  - [x] 实现产品状态默认值为"上架"

- [x] Task 4: 读写接口与稳定契约
  - [x] 写接口使用 `require_product_or_admin`
  - [x] 读接口允许任意已登录用户访问
  - [x] 列表接口返回 `PaginatedResponse`
  - [x] 列表接口支持 `spu_id` 预留筛选，作为 Story 3.4 / 4.4 底座
  - [x] 详情接口返回包装明细、继承结果与只读报关字段占位，供 Story 4.2 / 4.5 / 4.6 直接复用

- [x] Task 5: 测试与回归验证
  - [x] 新增 SKU 路由测试文件（建议 `erp-backend/tests/routers/test_skus.py`）
  - [x] 覆盖创建成功、继承逻辑、继承字段只读、编码不可改、包装明细、权限、列表筛选
  - [x] 验证报关字段默认只读占位，不提前开放 4.2 的写入边界
  - [x] 跑通 SKU 相关测试与后端回归测试

---

## Dev Notes

### 现有代码基础

- 现有后端模块实现模式可直接参考：
  - `erp-backend/app/models/spu.py`
  - `erp-backend/app/schemas/spu.py`
  - `erp-backend/app/repositories/spus.py`
  - `erp-backend/app/services/spus.py`
  - `erp-backend/app/routers/spus.py`
- 权限边界复用 `require_product_or_admin`、`get_current_user`
- 统一错误处理使用 `BusinessError`，中文错误消息需直接对齐 AC / PRD 文案
- 通用仓储 `BaseRepository` 已提供 `get_by_id`、`save`、`soft_delete`

### 关键实现约束

1. 本 Story 只做后端 API，不要提前侵入 4.2 / 4.3 / 4.4 / 4.5 / 4.6 的前端或专属业务流程
2. `skus` 表字段需一次性为后续故事打底，但 4.1 产品部 CRUD 只开放本故事需要的字段
3. 报关字段（HSCODE、监管条件、申报要素、退税税点、是否已维护）应在模型/迁移中落地，并在读接口输出，但写入权限留给 Story 4.2
4. 继承字段采用“SPU 为单一事实来源 + SKU 物化镜像”策略，SKU 保存时写入分类、供应商、禁止经营国家、客户质保期，便于后续列表/详情和下游模块直接按 SKU 取数
5. SPU 更新继承字段时，必须在同一事务内同步更新关联 SKU 镜像，避免出现 SPU 与 SKU 半成功不一致
6. 当前阶段从 SPU 继承过来的字段都不允许在 SKU 侧单独修改；4.5 表单应按只读继承字段处理
7. 列表接口从第一天就支持 `product_status`、`product_type`、`keyword`，并额外预留 `spu_id` 便于 3.4/4.4 复用
8. 包装明细子表优先采用与 SPU 开票信息一致的“软删除替换”策略，确保更新行为简单、稳定
9. 不要在本 Story 引入新依赖；现有 FastAPI / SQLAlchemy / Pydantic / pytest 已足够

### 推荐 API 范围

- `POST /api/v1/skus`：创建 SKU
- `GET /api/v1/skus`：分页列表，支持 `page`、`page_size`、`spu_id`、`level1_category_id`、`level2_category_id`、`level3_category_id`、`supplier_name`、`product_status`、`product_type`、`keyword`
- `GET /api/v1/skus/{id}`：获取单个 SKU 明细（含包装明细与只读报关字段）
- `PATCH /api/v1/skus/{id}`：更新除编码与继承字段外的可变字段；若切换 `spu_id`，需重新计算继承字段

### 推荐数据字段

- `skus`
  - `spu_id: int`
  - `code: str`
  - `name_zh: str`
  - `name_en: str`
  - `model: str`
  - `product_type: str`
  - `level1_category_id: int`
  - `level2_category_id: int`
  - `level3_category_id: int`
  - `supplier_name: str`
  - `restricted_countries: list[str]`
  - `customer_warranty_months: int`
  - `core_params: str`
  - `product_status: str`
  - `electrical_params: str | None`
  - `principle: str`
  - `usage: str`
  - `material: str | None`
  - `unit: str`
  - `has_plug: bool`
  - `is_special: bool`
  - `special_notes: str | None`
  - `package_type: str | None`
  - `package_quantity: int | None`
  - `customs_hscode: str | None`
  - `customs_supervision_condition: str | None`
  - `customs_declaration_elements: str | None`
  - `customs_refund_tax_rate: Decimal | None`
  - `customs_info_ready: bool`
  - 继承 `BaseModel`
- `sku_package_details`
  - `sku_id: int`
  - `net_weight_kg: Decimal | None`
  - `gross_weight_kg: Decimal | None`
  - `length_cm: Decimal | None`
  - `width_cm: Decimal | None`
  - `height_cm: Decimal | None`
  - `volume_cbm: Decimal | None`
  - `sort_order: int`
  - 继承 `BaseModel`

### 接口契约建议

- 写入 Schema 不应暴露继承字段编辑入口；若客户端提交继承字段，应直接返回 422，避免静默忽略
- 读取 Schema 建议返回：
  - `customer_warranty_months`: 当前由 SPU 同步到 SKU 的镜像值
  - `spu_code` / `spu_name`: 供 4.4 列表、4.6 详情与 3.4 SPU 详情复用
- 包装明细建议稳定返回 `sort_order`，未显式传入时按请求顺序补位，避免前端子表回显乱序

### 测试重点

- 创建 SKU 成功，且自动继承 SPU 的分类、供应商、禁止经营国家
- 客户质保期始终由 SPU 继承；SKU 创建/编辑提交该字段时返回 422
- 重复 `code` 返回 400：`"SKU编码已存在"`
- 更新时修改 `code` 返回 400：`"SKU编码创建后不可修改"`
- 产品状态默认值为 `"active"` 或等价中文映射的"上架"（需在实现中统一约定并保持 API 稳定）
- 包装明细创建与更新后顺序稳定、数据完整
- 商务部/财务部写接口返回 403，但读接口可访问
- 分类、供应商、产品状态、产品类型、关键词筛选生效
- 关键词支持 SKU编码/中文名称/英文名称模糊匹配
- SPU 更新继承字段后，同事务同步影响全部关联 SKU

### Project Structure Notes

- 当前已实现代码的命名风格与架构文档有轻微差异：
  - model/schema 倾向单数文件名，如 `spu.py`
  - repository/service/router 倾向复数文件名，如 `spus.py`
- 4.1 请继续延续当前仓库已验证通过的模式，不要混入新的文件组织风格
- 若需要共享枚举，请优先在 `sku.py` / `schemas/sku.py` 内部定义最小闭环，避免本 Story 为通用枚举系统过度铺陈

### References

- `_bmad-output/planning-artifacts/epics.md`（Epic 4 / Story 4.1）
- `_bmad-output/planning-artifacts/prd-product-management.md`（四、SKU 管理；权限矩阵；字段规则）
- `_bmad-output/planning-artifacts/architecture.md`（FR9-14 对应 `sku_service`）
- `_bmad-output/planning-artifacts/ux-design-specification.md`（SKU 表单分区、继承体验、包装明细）
- `_bmad-output/implementation-artifacts/3-1-spu-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/3-2-spu-列表页与筛选.md`
- `_bmad-output/implementation-artifacts/3-3-spu-新增编辑表单页.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Dev Agent Record

### Debug Log

- 2026-04-17: create-story 完成，已结合 Epic 4、PRD、Architecture、UX 与 3.1/3.2/3.3 既有模式补全 4.1 开发上下文
- 2026-04-17: 明确本 Story 以“后端模型与 CRUD API 底座” 为目标，报关字段仅建模和只读输出，不提前开放 4.2 写权限
- 2026-04-17: 完成 SKU 主表、包装明细子表、schema、repository、service、router 与 Alembic 迁移
- 2026-04-17: 落地 SPU 继承字段镜像、客户质保期只读继承、产品状态默认值、`spu_id` 预留筛选与只读报关字段占位
- 2026-04-17: 新增 `test_skus.py` 覆盖 4.1 核心流程，并调整 `test_spus.py` 以适配真实 `skus` 表结构后的供应商保护回归场景
- 2026-04-17: 后端验证通过，`bash scripts/backend-test.sh` 69/69 通过
- 2026-04-17: 根据 code review 与需求对齐，取消 SKU 对继承字段的单独修改入口，并将 SPU→SKU 镜像同步收敛为同事务更新

### Completion Notes

- 已生成 4.1 故事上下文，供 `dev-story` 直接实施
- 已明确继承字段镜像策略、客户质保期只读继承方案、包装明细子表与后续故事接口底座要求
- Ultimate context engine analysis completed - comprehensive developer guide created
- 已新增 `POST /api/v1/skus`、`GET /api/v1/skus`、`GET /api/v1/skus/{id}`、`PATCH /api/v1/skus/{id}` 四类接口
- 已完成 `skus` / `sku_package_details` 数据模型、软删除子表替换策略、SPU 继承字段镜像与质保期只读继承解析
- 已将报关字段作为只读底座纳入 detail 响应，为 Story 4.2 保留专属写入口边界
- 已新增 `erp-backend/tests/routers/test_skus.py`，并修复 `erp-backend/tests/routers/test_spus.py` 以匹配真实 SKU 结构
- 验证完成：`PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m compileall erp-backend/app erp-backend/tests`
- 后端验证完成：`bash scripts/backend-test.sh` 69/69 通过
- 已统一继承字段语义为“SPU 为单一事实来源，SKU 为物化镜像”，并落地 SPU 更新时同事务同步 SKU
- 已移除 SKU 对客户质保期等继承字段的写入入口，继承字段改为只读
- 已修复包装明细 `sort_order` 在未显式传入时全部落成 0 的契约风险

### File List

- `_bmad-output/implementation-artifacts/4-1-sku-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `erp-backend/app/main.py`
- `erp-backend/app/models/__init__.py`
- `erp-backend/app/models/sku.py`
- `erp-backend/app/schemas/sku.py`
- `erp-backend/app/repositories/skus.py`
- `erp-backend/app/services/skus.py`
- `erp-backend/app/routers/skus.py`
- `erp-backend/alembic/versions/0005_create_skus_tables.py`
- `erp-backend/tests/routers/test_skus.py`
- `erp-backend/tests/routers/test_spus.py`

### Change Log

- 2026-04-17: Story 创建并进入开发，状态更新为 in-progress
- 2026-04-17: Story 实现完成，后端 69 个测试全部通过，状态更新为 review
