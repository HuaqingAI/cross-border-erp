# Story 7.1: 价格数据模型与 CRUD API

**Status:** review
**Story Key:** 7-1-价格数据模型与-crud-api
**Epic:** 7 - 销售价格管理与审批
**Date:** 2026-04-21

---

## User Story

As a 财务部用户,
I want 为每个 SKU 设置多条区域价格（国家/地区、销售价、列表价、币种）,
So that 不同区域的客户获得对应的报价。

---

## Acceptance Criteria

**Given** `prices` 表及 `price_regions` 子表已创建  
**When** 财务部用户调用 `POST /api/v1/prices` 创建价格记录并指定 SKU  
**Then** 创建成功，系统自动带出 SKU 关联信息（名称、分类、SPU、采购价、供应商等）

**Given** 区域价格子表  
**When** 同一 SKU 同一国家/地区提交重复记录  
**Then** 返回 400 错误：`"同一 SKU 同一国家/地区不可重复设置价格"`（FR25）

**Given** 产品部用户尝试创建价格  
**When** 调用价格创建 API  
**Then** 返回 403 Forbidden（销售价格管理仅财务部和管理员可编辑）

---

## Scope

### In Scope

- 价格主表与区域价格子表的后端模型、迁移与 5-file backend 结构
- `POST /api/v1/prices`、`GET /api/v1/prices`、`GET /api/v1/prices/{id}`、`PATCH /api/v1/prices/{id}`、`DELETE /api/v1/prices/{id}` 五类接口
- 创建价格时基于 `sku_id` 自动带出 SKU / SPU / 分类 / 采购价 / 供应商等关联信息
- 一个价格记录对应一个 SKU，且下挂多条区域价格
- 同一 SKU + 同一国家/地区不可重复设置价格的业务校验
- 财务部 / 管理员可写，产品部 / 商务部只读
- 最小可用后端测试：创建成功、SKU 快照带出、区域价格多条、重复校验、权限、筛选、删除

### Out of Scope

- 价格提交审批、审批通过 / 驳回、审批日志 → Story 7.2
- SKU 详情页价格聚合展示改造
- 价格管理前端列表页 / 表单页 / 远程搜索交互 → Story 7.3
- 审批状态流转、版本对比、历史审计视图
- 对 SKU / SPU 详情接口的聚合返回结构改造

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-1 | done | FastAPI / SQLAlchemy / Alembic / Docker 基础设施已就绪 |
| 1-2 | done | 登录鉴权、Cookie 认证、`get_current_user` 已可用 |
| 1-3 | done | `require_finance_or_admin`、`can_view_purchase_price`、`BusinessError` 已可复用 |
| 2-1 | done | 分类数据模型与三级分类链路已稳定，可复用分类字段与关联规则 |
| 3-1 | done | SPU 数据模型与 CRUD API 已实现，可复用采购价、供应商、分类来源 |
| 4-1 | review（已合并到 `main`） | SKU 数据模型与 CRUD API 已实现，可复用 `sku_id` 关联与继承镜像字段 |
| 5-1 | review（已合并到 `main`） | 证书模块已验证子表 + 软删除 + 5-file backend 模式 |
| 6-1 / 6-2 | review（已合并到 `main`） | 资料 / FAQ 模块已验证 `PaginatedResponse`、`BusinessError`、CRUD 测试模式 |

---

## 实施任务建议

- [x] Task 1: 价格数据模型与迁移
  - [x] 新增 `erp-backend/app/models/price.py`，在同一文件中定义 `Price` 与 `PriceRegion`
  - [x] 在 `erp-backend/app/models/__init__.py` 注册新模型
  - [x] 新增 Alembic migration，创建 `prices` 与 `price_regions` 表、索引与外键
  - [x] 明确价格主表保存 SKU 关联快照字段，区域价格按子表存储

- [x] Task 2: 价格模块后端结构
  - [x] 新增 `erp-backend/app/schemas/price.py`
  - [x] 新增 `erp-backend/app/repositories/prices.py`
  - [x] 新增 `erp-backend/app/services/prices.py`
  - [x] 新增 `erp-backend/app/routers/prices.py`
  - [x] 在 `erp-backend/app/main.py` 注册 router

- [x] Task 3: 核心业务规则
  - [x] 实现 `sku_id` 存在性校验，并在创建 / 更新时自动刷新 SKU 关联快照信息
  - [x] 实现一个价格记录下支持多条区域价格
  - [x] 实现同一 SKU 同一国家/地区不可重复设置价格校验
  - [x] 实现删除时主表与区域价格子表的软删除一致性

- [x] Task 4: 读写接口与稳定契约
  - [x] 写接口使用 `require_finance_or_admin`
  - [x] 读接口允许任意已登录用户访问
  - [x] 列表接口返回 `PaginatedResponse`
  - [x] 详情与列表输出 SKU / SPU / 分类 / 采购价 / 供应商 / 区域价格摘要，为 Story 7.3 和后续聚合复用
  - [x] 保持 7.1 只做 CRUD API，不提前开放审批动作接口

- [x] Task 5: 测试与回归验证
  - [x] 新增价格路由测试文件（建议 `erp-backend/tests/routers/test_prices.py`）
  - [x] 新增价格服务测试文件（建议 `erp-backend/tests/services/test_prices.py`）
  - [x] 覆盖创建成功、SKU 快照带出、多区域价格、重复校验、权限、筛选、删除
  - [x] 跑通价格相关测试与后端回归测试

---

## Dev Notes

### 现有代码基础

- 现有后端模块实现模式可直接参考：
  - `erp-backend/app/models/faq.py`
  - `erp-backend/app/schemas/faq.py`
  - `erp-backend/app/repositories/faqs.py`
  - `erp-backend/app/services/faqs.py`
  - `erp-backend/app/routers/faqs.py`
  - `erp-backend/app/models/sku.py`
  - `erp-backend/app/models/spu.py`
- 权限边界复用 `require_finance_or_admin`、`get_current_user`
- 统一错误处理继续使用 `BusinessError`，返回结构保持 `PaginatedResponse` / `ErrorResponse`
- 当前仓库稳定采用单数 `model/schema`、复数 `repository/service/router` 的命名规则

### 关键实现约束

1. 本 Story 只做价格数据底座与 CRUD API，不要提前实现 7.2 审批流，也不要改造 SKU 详情页价格聚合展示
2. 价格主表与子表应沿用当前仓库已收敛的 5-file backend 结构，不重新发明模块组织方式
3. 价格主表应保存由 SKU / SPU / 分类带出的只读快照字段，避免 7.3 表单回显和后续审批展示再做重复拼装
4. 区域价格必须使用独立子表；创建与更新时按“软删除替换”方式保持实现简单稳定
5. 同一 SKU 同一国家/地区不可重复设置价格必须在写入前校验，并返回与 AC 对齐的中文错误文案
6. 写权限严格限定为财务部 / 管理员；产品部只读，不可写
7. 可为 7.2 预留稳定字段命名空间，但不要提前实现提交审批 / 审批通过 / 驳回逻辑
8. 不引入新依赖；现有 FastAPI / SQLAlchemy / Pydantic / pytest 足够完成本 Story

### 推荐 API 范围

- `POST /api/v1/prices`：创建价格
- `GET /api/v1/prices`：分页列表，支持 `page`、`page_size`、`sku_id`、`level1_category_id`、`supplier_name`、`keyword`
- `GET /api/v1/prices/{id}`：获取单个价格详情
- `PATCH /api/v1/prices/{id}`：更新价格主表与区域价格子表
- `DELETE /api/v1/prices/{id}`：软删除价格与区域价格

### 推荐数据字段

- `prices`
  - `sku_id: int`
  - `sku_code: str`
  - `sku_name_zh: str`
  - `sku_name_en: str`
  - `spu_id: int`
  - `spu_code: str`
  - `spu_name: str`
  - `level1_category_id: int`
  - `level2_category_id: int`
  - `level3_category_id: int`
  - `purchase_price: Decimal | None`
  - `supplier_name: str`
  - `product_model: str`
  - `product_status: str`
  - 继承 `BaseModel`
- `price_regions`
  - `price_id: int`
  - `country_code: str`
  - `country_name: str`
  - `currency: str`
  - `sale_price: Decimal`
  - `list_price: Decimal`
  - `remarks: str | None`
  - `sort_order: int`
  - 继承 `BaseModel`

### 接口契约建议

- 写入 Schema 应显式要求：
  - `sku_id: int`
  - `regions: list[PriceRegionPayload]`
- `regions` 至少一条，且单次请求内同一国家/地区不得重复
- 读取 Schema 建议返回：
  - `sku_code` / `sku_name_zh` / `sku_name_en`
  - `spu_code` / `spu_name`
  - `supplier_name`
  - `purchase_price`
  - `regions`
  - `region_summary`
- 区域价格子表建议稳定返回 `sort_order`，未显式传入时按请求顺序补位

### 测试重点

- 创建价格成功，且自动带出 SKU / SPU / 分类 / 采购价 / 供应商快照字段
- 一个价格记录可保存多条区域价格
- 单次请求内区域重复返回 400：`"同一 SKU 同一国家/地区不可重复设置价格"`
- 不同价格记录间重复占用同一 SKU + 国家/地区也返回 400
- 产品部写接口返回 403，财务部 / 管理员可写，所有已登录用户可读
- 列表支持 `sku_id`、`level1_category_id`、`supplier_name`、`keyword` 筛选
- 删除后列表不再返回该价格，详情返回 404

### References

- `_bmad-output/planning-artifacts/epics.md`（Epic 7 / Story 7.1）
- `_bmad-output/planning-artifacts/prd-product-management.md`（八、销售价格管理；FR24-FR25、FR36）
- `_bmad-output/planning-artifacts/architecture.md`（价格模块分层与 5-file backend 结构）
- `_bmad-output/implementation-artifacts/1-3-rbac-权限矩阵与字段级权限.md`
- `_bmad-output/implementation-artifacts/4-1-sku-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/6-2-faq-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Dev Agent Record

### Debug Log

- 2026-04-21: create-story 完成，已结合 Epic 7、PRD、Architecture、1.3 / 4.1 / 6.2 既有模式补全 7.1 开发上下文
- 2026-04-21: 明确本 Story 只做价格数据底座与 CRUD API，不提前实现审批流和 SKU 详情聚合展示
- 2026-04-21: 新增 `Price` / `PriceRegion` 模型与 Alembic `0010_create_prices_tables.py`，为价格主表与区域价格子表落地数据库结构
- 2026-04-21: 完成 `schemas/repositories/services/routers` 五件套，并注册 `/api/v1/prices` CRUD API
- 2026-04-21: 实现基于 `sku_id` 的 SKU / SPU / 分类 / 采购价 / 供应商快照带出、多区域价格写入、跨记录重复区域校验与软删除
- 2026-04-21: 新增价格路由与服务测试，并通过 `bash scripts/backend-test.sh` 后端全量回归，133/133 通过
- 2026-04-21: 根据 code review 修复价格读权限与 SKU 唯一主记录问题，新增价格读权限依赖、区域明细裁剪、`active_sku_id` 唯一索引与补充测试
- 2026-04-21: 根据后续 code review 补充 `price_regions` 活跃 `price_id + country_code` 唯一索引，并验证同国家/地区软删除替换更新仍可正常通过
- 2026-04-21: 为价格写路径与事务提交边界补充 `IntegrityError` → `BusinessError` 翻译，确保并发唯一索引冲突不再返回 500

### Completion Notes

- 已完成 `POST /api/v1/prices`、`GET /api/v1/prices`、`GET /api/v1/prices/{id}`、`PATCH /api/v1/prices/{id}`、`DELETE /api/v1/prices/{id}`
- 已实现价格主表与区域价格子表，支持一个价格记录对应一个 SKU、下挂多条区域价格
- 已实现价格创建 / 更新时自动带出 SKU、SPU、三级分类、采购价、供应商、产品型号、产品状态快照字段
- 已实现同一 SKU 同一国家/地区不可重复设置价格校验，单次请求内与跨价格记录都返回统一 `BusinessError`
- 已按现有权限模式接入 `require_finance_or_admin`，财务部 / 管理员可写，产品部不可写
- 已补齐 7.1 对应服务测试与路由测试，并通过后端全量回归
- 已修复 review 指出的两个 P1 问题：商务部不可访问价格读接口；同一 SKU 仅允许一个有效价格主记录，且数据库增加活跃记录唯一约束
- 已补充 `price_regions` 层面的数据库唯一约束，防止并发下写出同一价格记录的重复国家/地区行
- 已补齐数据库唯一索引冲突的错误翻译，主记录 / 区域价格并发冲突会返回稳定业务错误而非 500
- 残余风险：当前价格读接口未细分“产品部只读已生效价格 / 商务部可见范围”的审批后可见性差异，留待 Story 7.2 基于审批状态一起收口

### File List

- `_bmad-output/implementation-artifacts/7-1-价格数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `erp-backend/alembic/versions/0010_create_prices_tables.py`
- `erp-backend/app/main.py`
- `erp-backend/app/models/__init__.py`
- `erp-backend/app/models/price.py`
- `erp-backend/app/repositories/prices.py`
- `erp-backend/app/routers/prices.py`
- `erp-backend/app/schemas/price.py`
- `erp-backend/app/services/prices.py`
- `erp-backend/tests/routers/test_prices.py`
- `erp-backend/tests/services/test_prices.py`

### Change Log

- 2026-04-21: 初始创建 Story 7.1 implementation artifact，并进入开发
- 2026-04-21: 完成价格数据模型、CRUD API、SKU 快照带出、重复区域校验、权限控制、迁移与测试，并将 Story 状态更新为 `review`
- 2026-04-21: 修复 code review 提出的价格读权限泄露与同一 SKU 多主记录问题，并补充回归测试
- 2026-04-21: 补充价格区域数据库级唯一约束与同国家/地区替换更新回归测试
- 2026-04-21: 补充数据库唯一索引冲突的业务错误翻译与异常单测
