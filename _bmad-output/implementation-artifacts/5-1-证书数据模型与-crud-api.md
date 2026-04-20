# Story 5.1: 证书数据模型与 CRUD API

**Status:** review
**Story Key:** 5-1-证书数据模型与-crud-api
**Epic:** 5 - 产品证书管理
**Date:** 2026-04-20

---

## User Story

As a 产品部用户,
I want 创建和编辑产品证书（含有效期、归属模型），系统自动标记证书有效状态,
So that 合规证书数据完整录入系统，到期风险可被系统自动识别。

---

## Acceptance Criteria

**Given** `certificates` 表已创建（含名称、编号、类型、发证机构、有效期起止、归属类型、证书文件等字段）  
**When** 产品部用户调用 `POST /api/v1/certificates` 创建证书  
**Then** 证书创建成功，证书编号全局唯一

**Given** 证书有效期设置  
**When** 起始日期晚于或等于结束日期  
**Then** 返回 400 错误：`"有效期起始日期必须早于结束日期"`

**Given** 归属类型为"SPU归属"  
**When** 创建证书并指定适用 SPU（多选）  
**Then** 该证书关联到指定的 SPU（FR19）  
**And** 这些 SPU 下的 SKU 在详情查询时可聚合展示该证书

**Given** 归属类型为"按分类"  
**When** 创建证书并指定适用分类  
**Then** 该证书按分类归属保存（FR19）  
**And** 命中该分类的 SPU / SKU 在详情查询时可聚合展示该证书

**Given** 归属类型为"通用"  
**When** 创建证书  
**Then** 该证书在所有 SKU 详情查询中可聚合展示（FR19）

**Given** 证书列表查询  
**When** 传入筛选参数（证书类型、归属类型、有效状态、关键词）  
**Then** 返回匹配的分页证书列表（FR34, FR33）

---

## Scope

### In Scope

- 证书主表、SPU 归属关系表、分类归属关系表的后端模型、迁移与 5-file backend 结构
- `POST /api/v1/certificates`、`GET /api/v1/certificates`、`GET /api/v1/certificates/{id}`、`PATCH /api/v1/certificates/{id}`、`DELETE /api/v1/certificates/{id}` 五类接口
- 证书编号唯一性、有效期起止校验、通用 / SPU归属 / 按分类三种归属模型
- 列表分页与证书类型 / 归属类型 / 有效状态 / 关键词筛选
- 与现有 SPU / SKU / 分类的最小联通：创建时校验关联目标存在，持久化可供后续聚合故事复用的关系底座
- 最小可用后端测试：创建成功、唯一性、有效期校验、归属校验、筛选、权限、删除

### Out of Scope

- 证书到期定时扫描、自动批量更新、预警通知 → Story 5.2
- 证书管理前端页面、状态标签 UI、文件上传交互 → Story 5.3
- SKU / SPU 详情页真实聚合查询改造
- 证书文件对象存储写入流程；本 Story 仅保留文件字段契约
- 证书枚举值后台维护 → Epic 8

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-1 | done | FastAPI / SQLAlchemy / Alembic / Docker 基础设施已就绪 |
| 1-2 | done | 登录鉴权、Cookie 认证、`get_current_user` 已可用 |
| 1-3 | done | `require_product_or_admin`、`BusinessError` 与统一错误响应已可复用 |
| 2-1 | done | 分类三级树与分类存在性校验能力已实现 |
| 3-1 | done | SPU 数据模型与 CRUD API 已实现，可作为证书 SPU 归属目标 |
| 4-1 | review | SKU 数据模型与 CRUD API 已合并到 `main`，可作为后续证书聚合的联通目标 |

---

## 实施任务建议

- [x] Task 1: 证书数据模型与迁移
  - [x] 新增 `erp-backend/app/models/certificate.py`，定义 `Certificate`、`CertificateSPUAssignment`、`CertificateCategoryAssignment`
  - [x] 在 `erp-backend/app/models/__init__.py` 注册模型
  - [x] 新增 Alembic migration，创建证书主表与两张归属关系表、索引和外键
  - [x] 明确证书文件仅保存元数据字段，不提前接入上传流程

- [x] Task 2: 证书模块后端结构
  - [x] 新增 `erp-backend/app/schemas/certificate.py`
  - [x] 新增 `erp-backend/app/repositories/certificates.py`
  - [x] 新增 `erp-backend/app/services/certificates.py`
  - [x] 新增 `erp-backend/app/routers/certificates.py`
  - [x] 在 `erp-backend/app/main.py` 注册 router

- [x] Task 3: 核心业务规则
  - [x] 实现证书编号全局唯一校验
  - [x] 实现有效期起止校验
  - [x] 实现通用 / SPU归属 / 按分类三种归属模型的写入与读取
  - [x] 实现关联 SPU / 分类存在性校验，并对空数组做明确兜底
  - [x] 实现列表有效状态计算与筛选（仅查询时计算，不提前做 5.2 的批量回写）

- [x] Task 4: 读写接口与稳定契约
  - [x] 写接口使用 `require_product_or_admin`
  - [x] 读接口允许任意已登录用户访问
  - [x] 列表接口返回 `PaginatedResponse`
  - [x] 删除接口采用软删除，不物理删除历史数据
  - [x] 详情与列表输出归属摘要 / 归属 ID 集合，为 5.2 / 5.3 复用

- [x] Task 5: 测试与回归验证
  - [x] 新增证书路由测试文件（建议 `erp-backend/tests/routers/test_certificates.py`）
  - [x] 新增证书服务测试文件（建议 `erp-backend/tests/services/test_certificates.py`）
  - [x] 覆盖创建成功、唯一性、有效期校验、归属校验、筛选、权限、删除
  - [x] 跑通证书相关测试与后端回归测试

---

## Dev Notes

### 现有代码基础

- 现有后端模块实现模式可直接参考：
  - `erp-backend/app/models/spu.py`
  - `erp-backend/app/models/sku.py`
  - `erp-backend/app/schemas/spu.py`
  - `erp-backend/app/schemas/sku.py`
  - `erp-backend/app/repositories/spus.py`
  - `erp-backend/app/repositories/skus.py`
  - `erp-backend/app/services/spus.py`
  - `erp-backend/app/services/skus.py`
  - `erp-backend/app/routers/spus.py`
  - `erp-backend/app/routers/skus.py`
- 统一错误处理继续使用 `BusinessError`，并保持 `PaginatedResponse` / `ErrorResponse` 契约
- 当前仓库已稳定采用单数 `model/schema`、复数 `repository/service/router` 的命名规则

### 关键实现约束

1. 本 Story 只做证书数据底座和 CRUD API，不要提前实现 5.2 的定时预警任务、状态持久化批处理或 5.3 的前端页面
2. 有效状态可在 service / repository 查询阶段按 `valid_to` 与当前日期动态计算，用于列表与详情输出；不要额外引入定时回写字段依赖
3. 证书归属模型应采用“主表 + 关系表”模式，避免把多选 SPU / 分类 ID 直接塞进 JSON 字段，便于后续 SKU/SPU 聚合查询复用
4. 归属类型为 `通用` 时，`spu_ids` 与 `category_ids` 必须落为空集合；归属类型为 `SPU归属` / `按分类` 时，对应数组至少一项
5. 可选数组字段提交前后都必须兜底为 `[]`，避免后续故事依赖时出现 `null`
6. 与 SKU / SPU / 分类的联通只做到“关系可命中、后续可复用”的最小底座，不在本 Story 改造 SKU 详情聚合接口
7. 删除接口仅做软删除；唯一性校验只针对未删除记录
8. 不引入新依赖；现有 FastAPI / SQLAlchemy / Pydantic / pytest 足够完成本 Story

### 推荐 API 范围

- `POST /api/v1/certificates`：创建证书
- `GET /api/v1/certificates`：分页列表，支持 `page`、`page_size`、`certificate_type`、`ownership_type`、`validity_status`、`keyword`
- `GET /api/v1/certificates/{id}`：获取单个证书详情
- `PATCH /api/v1/certificates/{id}`：更新证书
- `DELETE /api/v1/certificates/{id}`：软删除证书

### 推荐数据字段

- `certificates`
  - `name: str`
  - `certificate_no: str`
  - `certificate_type: str`
  - `issuing_authority: str`
  - `valid_from: date`
  - `valid_to: date`
  - `ownership_type: str`
  - `file_object_key: str | None`
  - `file_url: str | None`
  - `file_name: str | None`
  - `remarks: str | None`
  - 继承 `BaseModel`
- `certificate_spu_assignments`
  - `certificate_id: int`
  - `spu_id: int`
  - 继承 `BaseModel`
- `certificate_category_assignments`
  - `certificate_id: int`
  - `category_id: int`
  - 继承 `BaseModel`

### 接口契约建议

- 写入 Schema 应显式暴露：
  - `ownership_type`
  - `spu_ids: list[int] = []`
  - `category_ids: list[int] = []`
- 读取 Schema 建议返回：
  - `ownership_type`
  - `spu_ids`
  - `category_ids`
  - `ownership_summary`
  - `validity_status`
- 关键词匹配至少覆盖证书名称、证书编号

### 测试重点

- 创建通用证书成功，且 `spu_ids` / `category_ids` 为空数组
- 创建 SPU 归属证书成功，且归属关系落库
- 创建分类归属证书成功，且归属关系落库
- 重复 `certificate_no` 返回 400：`"证书编号已存在"`
- `valid_from >= valid_to` 返回 400：`"有效期起始日期必须早于结束日期"`
- `ownership_type=spu` 且 `spu_ids=[]` 返回 400
- `ownership_type=category` 且 `category_ids=[]` 返回 400
- 写接口对商务部/财务部返回 403，读接口允许访问
- 列表支持证书类型、归属类型、有效状态、关键词筛选
- 删除后列表不再返回该证书

### References

- `_bmad-output/planning-artifacts/epics.md`（Epic 5 / Story 5.1）
- `_bmad-output/planning-artifacts/prd-product-management.md`（六、产品证书管理；FR18-FR21；FR33-FR34）
- `_bmad-output/planning-artifacts/architecture.md`（证书模块分层与 5-file backend 结构）
- `_bmad-output/planning-artifacts/ux-design-specification.md`（证书列表筛选与状态语义）
- `_bmad-output/implementation-artifacts/3-1-spu-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/4-1-sku-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Dev Agent Record

### Debug Log

- 2026-04-20: create-story 完成，已结合 Epic 5、PRD、Architecture、UX 与 3.1 / 4.1 已有实现模式补全 5.1 开发上下文
- 2026-04-20: 明确本 Story 仅做证书数据底座与 CRUD API，不提前实现 5.2 定时预警与 5.3 前端页面
- 2026-04-20: 新增 `Certificate` 主表与 SPU / 分类归属关系表，完成 Alembic `0007_create_certificates_tables.py`
- 2026-04-20: 落地 `schemas/repositories/services/routers` 五件套，注册 `/api/v1/certificates` CRUD API
- 2026-04-20: 使用查询时动态计算的方式实现证书有效状态（有效 / 即将过期 / 已过期），默认阈值 30 天，不越界到 Story 5.2 的定时回写
- 2026-04-20: 覆盖证书创建、更新、唯一性、有效期校验、归属校验、筛选、权限、删除等测试场景
- 2026-04-20: `bash scripts/backend-test.sh` 通过，后端测试 89/89 通过

### Completion Notes

- 已生成 5.1 故事上下文，供 `dev-story` 直接实施
- 已收敛证书归属模型为“主表 + 关系表”，避免后续聚合查询难以复用
- 已完成 `POST /api/v1/certificates`、`GET /api/v1/certificates`、`GET /api/v1/certificates/{id}`、`PATCH /api/v1/certificates/{id}`、`DELETE /api/v1/certificates/{id}`
- 已支持证书编号唯一性、有效期起止校验、通用 / SPU归属 / 按分类三种归属模型
- 已提供证书类型、归属类型、有效状态、关键词四类列表筛选，并保持统一错误响应契约
- 已完成 Story 5.1 开发与测试，当前状态可进入 code review

### File List

- `_bmad-output/implementation-artifacts/5-1-证书数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `erp-backend/alembic/versions/0007_create_certificates_tables.py`
- `erp-backend/app/main.py`
- `erp-backend/app/models/__init__.py`
- `erp-backend/app/models/certificate.py`
- `erp-backend/app/repositories/certificates.py`
- `erp-backend/app/routers/certificates.py`
- `erp-backend/app/schemas/certificate.py`
- `erp-backend/app/services/certificates.py`
- `erp-backend/tests/routers/test_certificates.py`
- `erp-backend/tests/services/test_certificates.py`

### Change Log

- 2026-04-20: 初始创建 Story 5.1 implementation artifact
- 2026-04-20: 完成证书数据模型、CRUD API、归属关系、列表筛选、测试与迁移实现，并将 Story 状态更新为 `review`
