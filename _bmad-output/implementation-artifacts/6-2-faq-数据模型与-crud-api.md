# Story 6.2: FAQ 数据模型与 CRUD API

**Status:** review
**Story Key:** 6-2-faq-数据模型与-crud-api
**Epic:** 6 - 产品资料库与 FAQ 管理
**Date:** 2026-04-21

---

## User Story

As a 产品部用户,
I want 创建和编辑 FAQ（支持全局范围和 SPU 级别），含附件上传,
So that 产品常见问题集中管理，客户沟通时可快速查阅。

---

## Acceptance Criteria

**Given** `faqs` 表已创建（含 SPU 关联（可选）、问题类型、问题、答案、附件字段）  
**When** 产品部用户调用 `POST /api/v1/faqs` 创建 FAQ 并指定 SPU  
**Then** FAQ 创建成功，关联到指定 SPU  
**And** 关联 FAQ 仅在 SPU / SKU 详情查询时聚合展示，不写回 SPU 或 SKU 主表

**Given** FAQ 创建时未指定 SPU  
**When** 保存  
**Then** FAQ 作为全局 FAQ，适用所有产品（FR22）

**Given** 问题字段  
**When** 输入超过 200 字  
**Then** 返回校验错误：`"问题最大 200 字"`

**Given** FAQ 支持附件  
**When** 上传附件文件  
**Then** 文件通过 OSS 预签名上传并关联（FR23）

---

## Scope

### In Scope

- FAQ 主表的后端模型、迁移与 5-file backend 结构
- `POST /api/v1/faqs`、`GET /api/v1/faqs`、`GET /api/v1/faqs/{id}`、`PATCH /api/v1/faqs/{id}`、`DELETE /api/v1/faqs/{id}` 五类接口
- 全局 FAQ / SPU 级 FAQ 两种归属模型
- 问题字段长度校验、SPU 存在性校验、附件对象键/URL 校验
- 与现有 SPU / SKU 的最小联通：FAQ 独立存储，不写回主表，但后续可供聚合复用
- 最小可用后端测试：创建成功、全局 FAQ、SPU 归属、长度校验、附件校验、权限、筛选、删除

### Out of Scope

- FAQ 前端列表页、表单页、远程搜索交互 → Story 6.3
- SPU / SKU 详情页真实聚合展示改造
- 多附件 FAQ、FAQ 分类体系扩展、FAQ 富文本编辑器
- 新的文件上传中转链路或对象存储方案重构

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-1 | done | FastAPI / SQLAlchemy / Alembic / Docker 基础设施已就绪 |
| 1-2 | done | 登录鉴权、Cookie 认证、`get_current_user` 已可用 |
| 1-3 | done | `require_product_or_admin`、`BusinessError` 与统一错误响应已可复用 |
| 3-1 | done | SPU 数据模型与 CRUD API 已可用，可作为 FAQ 的 SPU 归属目标 |
| 4-3 | done | MinIO / 预签名上传底座与 `/api/v1/files/presigned-url` 已可复用 |
| 5-1 | review（已合并到 `main`） | 证书模块已验证“5-file backend + BusinessError + PaginatedResponse”模式 |
| 6-1 | review（已合并到 `main`） | 产品资料模块已验证附件对象键校验与软删除 CRUD 模式，可直接复用 |

---

## 实施任务建议

- [x] Task 1: FAQ 数据模型与迁移
  - [x] 新增 `erp-backend/app/models/faq.py`，定义 `FAQ`
  - [x] 在 `erp-backend/app/models/__init__.py` 注册模型
  - [x] 新增 Alembic migration，创建 FAQ 主表、索引与外键
  - [x] 明确 FAQ 记录独立存储，不写回 SPU / SKU 主表

- [x] Task 2: FAQ 模块后端结构
  - [x] 新增 `erp-backend/app/schemas/faq.py`
  - [x] 新增 `erp-backend/app/repositories/faqs.py`
  - [x] 新增 `erp-backend/app/services/faqs.py`
  - [x] 新增 `erp-backend/app/routers/faqs.py`
  - [x] 在 `erp-backend/app/main.py` 注册 router

- [x] Task 3: 核心业务规则
  - [x] 实现全局 FAQ / 指定 SPU FAQ 两种归属模型
  - [x] 实现 `question` 最大 200 字校验
  - [x] 实现 `spu_id` 可选、指定时存在性校验
  - [x] 实现附件对象键 / URL 校验，并沿用现有 MinIO 预签名上传底座
  - [x] 实现 FAQ 仅独立存储，不回写 SPU / SKU 主表

- [x] Task 4: 读写接口与稳定契约
  - [x] 写接口使用 `require_product_or_admin`
  - [x] 读接口允许任意已登录用户访问
  - [x] 列表接口返回 `PaginatedResponse`
  - [x] 删除接口采用软删除，不物理删除 FAQ 历史数据
  - [x] 详情与列表输出 `spu_id`、`spu` 摘要与附件字段，为后续 6.3 / 聚合故事复用

- [x] Task 5: 测试与回归验证
  - [x] 新增 FAQ 路由测试文件（建议 `erp-backend/tests/routers/test_faqs.py`）
  - [x] 新增 FAQ 服务测试文件（建议 `erp-backend/tests/services/test_faqs.py`）
  - [x] 覆盖创建成功、全局 FAQ、SPU 归属、长度校验、附件校验、权限、筛选、删除
  - [x] 跑通 FAQ 相关测试与后端回归测试

---

## Dev Notes

### 现有代码基础

- 现有后端模块实现模式可直接参考：
  - `erp-backend/app/models/product_document.py`
  - `erp-backend/app/schemas/product_document.py`
  - `erp-backend/app/repositories/product_documents.py`
  - `erp-backend/app/services/product_documents.py`
  - `erp-backend/app/routers/product_documents.py`
  - `erp-backend/app/models/spu.py`
- 统一错误处理继续使用 `BusinessError`，并保持 `PaginatedResponse` / `ErrorResponse` 契约
- 当前仓库已稳定采用单数 `model/schema`、复数 `repository/service/router` 的命名规则

### 关键实现约束

1. 本 Story 只做 FAQ 数据底座和 CRUD API，不要提前实现 6.3 前端页面或 SPU / SKU 详情聚合页面
2. FAQ 当前只支持“全局 / 指定 SPU”两种归属，不要扩展到 SKU / 分类 FAQ
3. FAQ 记录独立存储，不写回 SPU / SKU 主表；本 Story 只打好后续聚合可复用的最小底座
4. 附件继续复用现有 `/api/v1/files/presigned-url` 与 `app/core/storage.py`；本 Story 只校验并持久化 `object_key` / `file_url` / `file_name`
5. 问题字段最大 200 字必须在写入前校验；答案字段按 PRD 也建议控制在 200 字，保持简单 FAQ 的契约稳定
6. `spu_id` 为可选；为空时表示全局 FAQ，非空时必须命中有效 SPU
7. 删除接口仅做软删除
8. 不引入新依赖；现有 FastAPI / SQLAlchemy / Pydantic / pytest 足够完成本 Story

### 推荐 API 范围

- `POST /api/v1/faqs`：创建 FAQ
- `GET /api/v1/faqs`：分页列表，支持 `page`、`page_size`、`spu_id`、`question_type`、`keyword`
- `GET /api/v1/faqs/{id}`：获取单个 FAQ 详情
- `PATCH /api/v1/faqs/{id}`：更新 FAQ
- `DELETE /api/v1/faqs/{id}`：软删除 FAQ

### 推荐数据字段

- `faqs`
  - `spu_id: int | None`
  - `question_type: str | None`
  - `question: str`
  - `answer: str`
  - `attachment_object_key: str | None`
  - `attachment_file_url: str | None`
  - `attachment_file_name: str | None`
  - `remarks: str | None`
  - 继承 `BaseModel`

### 接口契约建议

- 写入 Schema 应显式暴露：
  - `spu_id: int | None = None`
  - `question_type: str | None = None`
  - `question`
  - `answer`
  - `attachment_object_key: str | None = None`
  - `attachment_file_url: str | None = None`
  - `attachment_file_name: str | None = None`
- 读取 Schema 建议返回：
  - `spu_id`
  - `scope_summary`
  - `spu_code`
  - `spu_name`
  - `attachment_object_key`
  - `attachment_file_url`
  - `attachment_file_name`

### 测试重点

- 创建全局 FAQ 成功，且 `spu_id` 为空
- 创建 SPU FAQ 成功，且归属到指定 SPU
- `question` 超过 200 字返回 422 或等价校验错误
- 指定不存在的 `spu_id` 返回 404
- 附件对象键 / URL 不匹配时返回 400
- 商务部/财务部写接口返回 403，但读接口可访问
- 列表支持 `spu_id`、`question_type`、`keyword` 筛选
- 删除后列表不再返回该 FAQ

### References

- `_bmad-output/planning-artifacts/epics.md`（Epic 6 / Story 6.2）
- `_bmad-output/planning-artifacts/prd-product-management.md`（七、FAQ 管理；FR22-FR23）
- `_bmad-output/planning-artifacts/architecture.md`（FAQ 模块分层与 5-file backend 结构）
- `_bmad-output/implementation-artifacts/3-1-spu-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/6-1-产品资料数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Dev Agent Record

### Debug Log

- 2026-04-21: create-story 完成，已结合 Epic 6、PRD、Architecture、3.1 / 4.3 / 6.1 既有模式补全 6.2 开发上下文
- 2026-04-21: 明确本 Story 仅做 FAQ 数据底座与 CRUD API，不提前实现 FAQ 前端页或 SPU / SKU 详情聚合展示
- 2026-04-21: 新增 `FAQ` 主表并完成 Alembic `0009_create_faqs_table.py`
- 2026-04-21: 落地 `schemas/repositories/services/routers` 五件套，注册 `/api/v1/faqs` CRUD API
- 2026-04-21: 完成全局 / 指定 SPU FAQ、问题/答案长度校验、附件对象键校验与 SPU 最小联通
- 2026-04-21: 新增 FAQ 服务与路由测试，并通过 `bash scripts/backend-test.sh` 全量后端回归，123/123 通过

### Completion Notes

- 已生成 6.2 故事上下文，供 `dev-story` 直接实施
- 已完成 `POST /api/v1/faqs`、`GET /api/v1/faqs`、`GET /api/v1/faqs/{id}`、`PATCH /api/v1/faqs/{id}`、`DELETE /api/v1/faqs/{id}`
- 已支持全局 FAQ 与指定 SPU FAQ 两种归属、问题/答案字段、单附件字段与作用范围摘要输出
- 已实现问题最大 200 字、SPU 存在性、附件对象键 / URL 匹配与 FAQ 软删除等核心规则
- 已复用现有 MinIO / 预签名上传底座，FAQ 附件保持 `attachment_object_key` / `attachment_file_url` / `attachment_file_name` 稳定契约
- 已完成 Story 6.2 开发与测试，当前状态可进入 code review
- 残余风险：当前测试未覆盖真实 MySQL 上的 Alembic 升级链；合并前建议在 MySQL 环境执行一次 `alembic upgrade head`

### File List

- `_bmad-output/implementation-artifacts/6-2-faq-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `erp-backend/alembic/versions/0009_create_faqs_table.py`
- `erp-backend/app/main.py`
- `erp-backend/app/models/__init__.py`
- `erp-backend/app/models/faq.py`
- `erp-backend/app/repositories/faqs.py`
- `erp-backend/app/routers/faqs.py`
- `erp-backend/app/schemas/faq.py`
- `erp-backend/app/services/faqs.py`
- `erp-backend/tests/routers/test_faqs.py`
- `erp-backend/tests/services/test_faqs.py`

### Change Log

- 2026-04-21: 初始创建 Story 6.2 implementation artifact，并进入开发
- 2026-04-21: 完成 FAQ 数据模型、CRUD API、SPU 归属、附件字段、测试与迁移实现，并将 Story 状态更新为 `review`
