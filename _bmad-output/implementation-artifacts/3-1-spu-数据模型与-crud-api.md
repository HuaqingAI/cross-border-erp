# Story 3.1: SPU 数据模型与 CRUD API

**Status:** done
**Story Key:** 3-1-spu-数据模型与-crud-api
**Epic:** 3 - SPU 管理
**Date:** 2026-04-17

---

## User Story

As a 产品部用户,
I want 创建和编辑 SPU（含基础信息、采购信息、多条开票信息），每个 SPU 唯一绑定一个供应商,
So that 产品型号数据完整录入系统，作为 SKU 的父级实体和数据继承源。

---

## Acceptance Criteria

**Given** `spus` 表及 `spu_invoice_infos` 子表已创建  
**When** 产品部用户调用 `POST /api/v1/spus` 创建 SPU  
**Then** SPU 创建成功，含基础信息（编码、名称、分类、质保期、单位、禁止经营国家）、采购信息（供应商、厂家型号、采购价、采购质保期）  
**And** SPU 编码全局唯一

**Given** SPU 已创建  
**When** 尝试修改 SPU 编码  
**Then** 返回 400 错误：`"SPU编码创建后不可修改"`

**Given** SPU 下已有 SKU 被业务单据引用  
**When** 尝试修改该 SPU 的供应商  
**Then** 返回 400 错误：`"该SPU下已有SKU被业务引用，供应商不可变更"`（FR6）

**Given** SPU 创建时关联开票信息  
**When** 提交不包含任何开票信息的 SPU  
**Then** 返回 400 错误：`"开票信息至少需要一条"`

**Given** SPU 创建时选择分类  
**When** 调用分类级联 API `GET /api/v1/products/categories/tree`  
**Then** 返回完整的三级分类树，支持前端级联选择（FR8）

**Given** 产品部用户查询 SPU 列表  
**When** 传入筛选参数（一级/二级/三级分类、供应商、关键词）  
**Then** 返回匹配的分页 SPU 列表（FR32, FR33）

---

## Scope

### In Scope

- SPU 主表与开票信息子表的后端模型、迁移与 5-file backend 结构
- `POST /api/v1/spus`、`GET /api/v1/spus`、`GET /api/v1/spus/{id}`、`PATCH /api/v1/spus/{id}` 四类接口
- 复用现有 `GET /api/v1/products/categories/tree` 分类树接口，不重复造轮子
- 产品部/管理员可写，已登录用户可读的权限边界
- 列表分页、分类/供应商/关键词筛选
- SPU 编码不可修改、开票信息至少一条、供应商变更受限等核心业务规则
- 最小可用后端测试：模型约束、权限校验、列表筛选、字段级权限、关键业务错误路径

### Out of Scope

- SPU 列表前端页面 → Story 3.2
- SPU 新增/编辑表单页 → Story 3.3
- SPU 详情页聚合展示 → Story 3.4
- 删除 SPU 接口
- 供应商主数据、公司主体主数据、国家/单位枚举管理后台
- SKU 真正继承 SPU、SKU 业务单据联动 → Epic 4 / 后续业务模块

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-1 | done | FastAPI / SQLAlchemy / Alembic / Docker 基础设施已就绪 |
| 1-2 | done | 登录鉴权、Cookie 认证、`get_current_user` 已可用 |
| 1-3 | done | `require_product_or_admin`、字段级权限辅助函数已可复用 |
| 2-1 | done | 分类树 API 已可复用，且删除保护已预留 SPU 关联检查 |
| 2-2 | done | 前端 SPU 路由占位已存在，后续 3.2 可直接接入 |

---

## 实施任务建议

- [x] Task 1: SPU 数据模型与迁移
  - [x] 新增 `erp-backend/app/models/spu.py`，在同一文件中定义 `SPU` 与 `SPUInvoiceInfo`
  - [x] 在 `erp-backend/app/models/__init__.py` 注册新模型
  - [x] 新增 Alembic migration，创建 `spus` 与 `spu_invoice_infos` 表、索引与外键
  - [x] 明确分类字段采用 `level1_category_id` / `level2_category_id` / `level3_category_id`
  - [x] 明确 `restricted_countries` 的存储形式，并保证 SQLite 测试库与 MySQL 生产库都可工作

- [x] Task 2: SPU 模块后端结构
  - [x] 新增 `erp-backend/app/schemas/spu.py`
  - [x] 新增 `erp-backend/app/repositories/spus.py`
  - [x] 新增 `erp-backend/app/services/spus.py`
  - [x] 新增 `erp-backend/app/routers/spus.py`
  - [x] 在 `erp-backend/app/main.py` 注册 router

- [x] Task 3: 核心业务规则
  - [x] 实现 SPU 编码全局唯一校验
  - [x] 实现 SPU 编码创建后不可修改
  - [x] 实现开票信息至少一条校验
  - [x] 实现分类三级链路校验，禁止跨层级或不一致的分类组合
  - [x] 实现供应商变更保护，检查“SPU 下已有 SKU 被业务引用”这一约束的可扩展钩子

- [x] Task 4: 读写接口与字段级权限
  - [x] 写接口使用 `require_product_or_admin`
  - [x] 读接口允许任意已登录用户访问
  - [x] 列表接口返回 `PaginatedResponse`
  - [x] 对商务部隐藏采购价字段，避免违背 FR36
  - [x] 详情接口返回开票信息子表，供 Story 3.3/3.4 直接复用

- [x] Task 5: 测试与回归验证
  - [x] 新增 SPU 路由测试文件（建议 `erp-backend/tests/routers/test_spus.py`）
  - [x] 覆盖创建成功、编码不可改、开票信息为空、权限、列表筛选、采购价可见性
  - [x] 构造最小反射表或测试桩，验证供应商不可变更规则
  - [x] 跑通后端全量 pytest

---

## Dev Notes

### 现有代码基础

- 已有分类树 API：`GET /api/v1/products/categories/tree`，请直接复用，不要新增第二套级联接口
- 现有模块实现模式可直接参考 `product_category`：
  - `erp-backend/app/models/product_category.py`
  - `erp-backend/app/schemas/product_category.py`
  - `erp-backend/app/repositories/product_categories.py`
  - `erp-backend/app/services/product_categories.py`
  - `erp-backend/app/routers/product_categories.py`
- 统一错误处理使用 `BusinessError`，中文错误消息应直接对齐 AC / PRD 文案
- 通用仓储 `BaseRepository` 已提供 `get_by_id`、`save`、`soft_delete`

### 关键实现约束

1. 本 Story 只做后端 API，不要提前侵入 Story 3.2 / 3.3 / 3.4 的页面实现
2. 当前仓库没有供应商主数据、公司主体主数据、国家/单位枚举模块，不要在 3.1 临时发明新的后台管理模块
3. 为了满足当前故事且不扩大范围，供应商、公司主体、单位先按业务值存储：
   - `supplier_name`: 字符串
   - `company_subject`: 字符串
   - `unit`: 字符串
   - `restricted_countries`: `list[str]` 对应的 JSON 存储
4. 分类字段请采用 `level1_category_id` / `level2_category_id` / `level3_category_id`，与 2.1 删除保护中的候选列保持一致
5. 三级分类链路必须由服务层校验，不要信任前端直接传入的三个 ID 一定匹配
6. `GET /api/v1/spus` / `GET /api/v1/spus/{id}` 需要从第一天就考虑 FR36：
   - 产品部、财务部、管理员可见 `purchase_price`
   - 商务部不可见 `purchase_price`
7. 开票信息子表至少一条，更新时同样需要校验，不能只在创建时校验
8. 不要在本故事引入新依赖；现有 FastAPI / SQLAlchemy / Pydantic / pytest 能满足需求

### 供应商变更规则落地建议

- AC 要求“SPU 下已有 SKU 被业务单据引用时，供应商不可变更”，但当前仓库尚未落地 SKU 与业务单据模块
- 本 Story 应将该校验集中在 service/repository 层的单一入口中，采用“可扩展检查点”设计：
  - 当前阶段至少支持反射检查 `skus` 及后续业务引用表是否存在
  - 若相关表不存在，应返回“允许变更”，但代码结构必须便于 Epic 4/后续故事补充真实检查
  - 不要把判断逻辑硬编码在 router

### 推荐 API 范围

- `POST /api/v1/spus`：创建 SPU
- `GET /api/v1/spus`：分页列表，支持 `page`、`page_size`、`level1_category_id`、`level2_category_id`、`level3_category_id`、`supplier_name`、`keyword`
- `GET /api/v1/spus/{id}`：获取单个 SPU 明细（含开票信息）
- `PATCH /api/v1/spus/{id}`：更新除编码外的可变字段

### 推荐数据字段

- `spus`
  - `code: str`
  - `name: str`
  - `level1_category_id: int`
  - `level2_category_id: int`
  - `level3_category_id: int`
  - `customer_warranty_months: int`
  - `unit: str`
  - `restricted_countries: list[str]`
  - `supplier_name: str`
  - `manufacturer_model: str`
  - `purchase_price: Decimal | None`
  - `purchase_warranty_months: int | None`
  - `supplier_warranty_notes: str | None`
  - 继承 `BaseModel`
- `spu_invoice_infos`
  - `spu_id: int`
  - `invoice_name: str`
  - `invoice_unit: str`
  - `invoice_model: str`
  - `company_subject: str`
  - `sort_order: int`
  - 继承 `BaseModel`

### 测试重点

- 创建 SPU 成功，且开票信息一并落库
- 重复 `code` 返回 400：`"SPU编码已存在"`
- 更新时修改 `code` 返回 400：`"SPU编码创建后不可修改"`
- 空开票信息返回 400：`"开票信息至少需要一条"`
- 商务部/财务部写接口返回 403，但读接口可访问
- 商务部读取列表/详情时不包含 `purchase_price`
- 分类筛选、供应商筛选、关键词筛选生效
- 分类树接口复用现有 `/products/categories/tree`
- 供应商变更保护通过反射表或桩验证一条失败路径

### Project Structure Notes

- 当前已实现代码的命名风格与架构文档有轻微差异：
  - model/schema 倾向单数文件名，如 `product_category.py`
  - repository/service/router 倾向复数文件名，如 `product_categories.py`
- 3.1 请延续当前仓库已经落地并验证通过的模式，而不是机械照抄架构草案中的文件名
- 前端占位页 `erp-frontend/src/features/products/spus/pages/SPUListPage.tsx` 已存在，但本 Story 不应修改它

### Library / Framework Notes

- 后端依赖以仓库当前约束为准：
  - `fastapi>=0.115.0`
  - `sqlalchemy>=2.0.0`
  - `pydantic>=2.0.0`
  - `alembic>=1.13.0`
  - `pytest>=8.0.0`
- 测试数据库默认是 SQLite 共享内存；实现 JSON/Decimal/外键逻辑时，必须兼容 SQLite 与 MySQL 两种执行环境

### References

- `_bmad-output/planning-artifacts/epics.md`（Epic 3 / Story 3.1）
- `_bmad-output/planning-artifacts/prd-product-management.md`（三、SPU 管理；权限矩阵；字段规则）
- `_bmad-output/planning-artifacts/architecture.md`（需求到结构映射；FR5-8 对应 `spu_service`）
- `_bmad-output/implementation-artifacts/2-1-分类数据模型与三级分类-crud-api.md`
- `_bmad-output/implementation-artifacts/2-2-分类管理前端页面.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Dev Agent Record

### Debug Log

- 2026-04-17: create-story 完成，已结合 Epic 3、PRD、Architecture、2.1/2.2 落地模式补全 3.1 开发上下文
- 2026-04-17: 明确本 Story 不引入供应商/公司主体/枚举主数据模块，避免开发范围失控
- 2026-04-17: 完成 SPU 主表、开票子表、schema、repository、service、router 与 Alembic 迁移
- 2026-04-17: 实现分类三级链路校验、供应商变更保护反射检查、读接口采购价字段级权限控制
- 2026-04-17: 修复 2.1 分类删除保护测试与真实 `spus` 表结构不一致的问题，后端回归恢复通过
- 2026-04-17: 根据 code review 补充 SPU 路由显式 `response_model`，收紧 OpenAPI 契约与敏感字段输出边界
- 2026-04-17: 将分类删除保护测试夹具改为合法三级分类树 + 有效 SPU 数据，避免不合法测试数据造成误导
- 2026-04-17: 与 4.1 规则对齐，明确 SPU 为继承字段单一事实来源；当分类、供应商、禁止经营国家、客户质保期变更时，同事务同步关联 SKU 镜像

### Completion Notes

- 已生成 3.1 故事上下文，供 `dev-story` 直接实施
- 已明确分类字段命名、供应商/公司主体落地边界、字段级权限要求与测试重点
- Ultimate context engine analysis completed - comprehensive developer guide created
- 已新增 `POST /api/v1/spus`、`GET /api/v1/spus`、`GET /api/v1/spus/{id}`、`PATCH /api/v1/spus/{id}` 四类接口
- 已实现 `spus` / `spu_invoice_infos` 数据模型、软删除开票信息替换策略与分类三级链路校验
- 已实现商务部隐藏采购价、财务部可见采购价的读接口字段级权限
- 已新增 `erp-backend/tests/routers/test_spus.py`，并修正 `test_product_categories.py` 以适配真实 SPU 表结构
- 验证完成：`PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m compileall erp-backend/app erp-backend/tests`
- 后端验证完成：`bash scripts/backend-test.sh` 59/59 通过
- 已根据 code review 为 SPU 路由补上显式响应模型声明，降低后续敏感字段误暴露风险
- 已根据 code review 将分类删除保护测试改为使用合法 SPU 夹具，提升回归测试可信度
- 已补充继承字段同步语义：SPU 更新继承字段时负责同事务更新下属 SKU 镜像，避免后续 SKU 读取口径漂移

### File List

- `erp-backend/app/models/spu.py`
- `erp-backend/app/models/__init__.py`
- `erp-backend/app/schemas/spu.py`
- `erp-backend/app/repositories/spus.py`
- `erp-backend/app/services/spus.py`
- `erp-backend/app/routers/spus.py`
- `erp-backend/app/main.py`
- `erp-backend/alembic/versions/0004_create_spus_tables.py`
- `erp-backend/tests/routers/test_spus.py`
- `erp-backend/tests/routers/test_product_categories.py`
- `_bmad-output/implementation-artifacts/3-1-spu-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-17: Story 创建，状态 ready-for-dev
- 2026-04-17: Story 实现完成，后端 59 个测试全部通过，状态更新为 review
- 2026-04-17: 根据 code review 修复接口响应模型声明与分类删除保护测试夹具问题，后端 59 个测试重新通过
- 2026-04-17: 分支已合并到 main，Story 状态更新为 done
- 2026-04-17: 与 4.1 需求澄清同步，补充 SPU 更新时对关联 SKU 继承字段镜像的同事务同步约束
