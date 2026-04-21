# Story 6.1: 产品资料数据模型与 CRUD API

**Status:** review
**Story Key:** 6-1-产品资料数据模型与-crud-api
**Epic:** 6 - 产品资料库与 FAQ 管理
**Date:** 2026-04-21

---

## User Story

As a 产品部用户,
I want 创建和编辑产品资料（含富文本内容、多文件附件、灵活归属模型）,
So that 产品相关文档集中管理，不再分散在各部门文件夹中。

---

## Acceptance Criteria

**Given** `product_documents` 表已创建（含名称、类型、内容（富文本）、归属类型、适用SKU、适用分类、国家/地区等字段）  
**When** 产品部用户调用 `POST /api/v1/products/documents` 创建资料  
**Then** 资料创建成功

**Given** 资料提交时  
**When** 资料内容和资料文件均为空  
**Then** 返回 400 错误：`"资料内容和资料文件至少填写一项"`

**Given** 归属类型为"指定SKU"  
**When** 未选择任何 SKU  
**Then** 返回 400 错误：`"归属类型为'指定SKU'时，SKU 选择必填"`（FR16）

**Given** 归属类型为"按分类"  
**When** 未选择分类  
**Then** 返回 400 错误：`"归属类型为'按分类'时，分类选择必填"`（FR16）

**Given** 资料设定了适用国家/地区  
**When** SKU 详情页展示资料  
**Then** 仅展示匹配国家/地区的资料（FR17）  
**And** 资料记录保持独立存储，不写回 SKU 主表

**Given** 资料支持多文件附件  
**When** 上传多个文件  
**Then** 所有文件通过 OSS 预签名上传，URL 关联到资料记录

---

## Scope

### In Scope

- 产品资料主表、SKU 归属关系表、分类归属关系表、附件关系表的后端模型、迁移与 5-file backend 结构
- `POST /api/v1/products/documents`、`GET /api/v1/products/documents`、`GET /api/v1/products/documents/{id}`、`PATCH /api/v1/products/documents/{id}`、`DELETE /api/v1/products/documents/{id}` 五类接口
- 富文本内容 / 多文件附件至少填写一项校验
- 通用 / 指定SKU / 按分类三种归属模型与最小联通校验
- 适用国家/地区持久化与读写契约
- 复用现有 `/api/v1/files/presigned-url` 与 MinIO/预签名上传底座，不另起上传方案
- 最小可用后端测试：创建成功、归属校验、内容/附件校验、附件持久化、权限、列表、删除

### Out of Scope

- FAQ 数据模型与接口 → Story 6.2
- 产品资料 / FAQ 前端页面 → Story 6.3
- SKU 详情页真实聚合展示改造
- FAQ 附件方案、资料前端富文本编辑器集成
- 新的文件上传中转链路或对象存储方案重构

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-1 | done | FastAPI / SQLAlchemy / Alembic / Docker 基础设施已就绪 |
| 1-2 | done | 登录鉴权、Cookie 认证、`get_current_user` 已可用 |
| 1-3 | done | `require_product_or_admin`、`BusinessError` 与统一错误响应已可复用 |
| 2-1 | done | 分类三级树与分类存在性校验能力已实现 |
| 4-1 | review（已合并到 `main`） | SKU 数据模型与 CRUD API 已可用，可作为资料指定 SKU 归属目标 |
| 4-3 | done | MinIO / 预签名上传底座与 `/api/v1/files/presigned-url` 已可复用 |
| 5-1 | review（已合并到 `main`） | 证书模块已验证“主表 + 关系表 + 5-file backend”模式，可直接复用 |
| 5-3 | review（已合并到 `main`） | 证书前端已验证附件字段契约，资料模块应保持相同上传底座 |

---

## 实施任务建议

- [x] Task 1: 产品资料数据模型与迁移
  - [x] 新增 `erp-backend/app/models/product_document.py`，定义 `ProductDocument`、`ProductDocumentSKUAssignment`、`ProductDocumentCategoryAssignment`、`ProductDocumentAttachment`
  - [x] 在 `erp-backend/app/models/__init__.py` 注册模型
  - [x] 新增 Alembic migration，创建主表、归属关系表、附件表、索引与外键
  - [x] 明确资料记录独立存储，不写回 SKU 主表

- [x] Task 2: 产品资料模块后端结构
  - [x] 新增 `erp-backend/app/schemas/product_document.py`
  - [x] 新增 `erp-backend/app/repositories/product_documents.py`
  - [x] 新增 `erp-backend/app/services/product_documents.py`
  - [x] 新增 `erp-backend/app/routers/product_documents.py`
  - [x] 在 `erp-backend/app/main.py` 注册 router

- [x] Task 3: 核心业务规则
  - [x] 实现资料内容 / 附件至少一项校验
  - [x] 实现通用 / 指定SKU / 按分类三种归属模型校验与持久化
  - [x] 实现 `ownership_type=指定SKU` 时 `sku_ids` 必填校验
  - [x] 实现 `ownership_type=按分类` 时 `category_ids` 必填校验
  - [x] 实现适用国家/地区数组兜底为 `[]`
  - [x] 实现多附件对象键 / URL 关联校验，并沿用现有 MinIO 预签名上传底座

- [x] Task 4: 读写接口与稳定契约
  - [x] 写接口使用 `require_product_or_admin`
  - [x] 读接口允许任意已登录用户访问
  - [x] 列表接口返回 `PaginatedResponse`
  - [x] 删除接口采用软删除，不物理删除资料与附件历史数据
  - [x] 详情与列表输出归属摘要、归属 ID 集合、附件列表和适用国家/地区，为后续 6.3 / SKU 聚合复用

- [x] Task 5: 测试与回归验证
  - [x] 新增资料路由测试文件（建议 `erp-backend/tests/routers/test_product_documents.py`）
  - [x] 新增资料服务测试文件（建议 `erp-backend/tests/services/test_product_documents.py`）
  - [x] 覆盖创建成功、内容/附件校验、归属校验、存在性校验、附件校验、权限、筛选、删除
  - [x] 跑通资料相关测试与后端回归测试

---

## Dev Notes

### 现有代码基础

- 现有后端模块实现模式可直接参考：
  - `erp-backend/app/models/certificate.py`
  - `erp-backend/app/schemas/certificate.py`
  - `erp-backend/app/repositories/certificates.py`
  - `erp-backend/app/services/certificates.py`
  - `erp-backend/app/routers/certificates.py`
  - `erp-backend/app/models/sku.py`
  - `erp-backend/app/models/product_category.py`
- 统一错误处理继续使用 `BusinessError`，并保持 `PaginatedResponse` / `ErrorResponse` 契约
- 当前仓库已稳定采用单数 `model/schema`、复数 `repository/service/router` 的命名规则

### 关键实现约束

1. 本 Story 只做产品资料数据底座和 CRUD API，不要提前实现 6.2 FAQ、6.3 前端页面或 SKU 详情聚合页面
2. 资料归属模型应采用“主表 + 关系表 + 附件表”模式，不把多选 SKU / 分类 / 附件直接塞进 JSON 字段
3. 资料内容与资料文件至少填写一项；`content_html` 仅空白字符时视为未填写
4. 归属类型为 `通用` 时，`sku_ids` 与 `category_ids` 必须落为空集合；归属类型为 `指定SKU` / `按分类` 时，对应字段至少一项
5. 可选数组字段提交前后都必须兜底为 `[]`，包括 `sku_ids`、`category_ids`、`applicable_countries`、`attachments`
6. 多文件附件继续复用现有 `/api/v1/files/presigned-url` 与 `app/core/storage.py`；本 Story 只校验并持久化 `object_key` / `file_url` / `file_name`
7. 与 SKU / 分类的联通只做到“关系存在可校验、后续可聚合复用”的最小底座，不在本 Story 改造 SKU 详情接口
8. 删除接口仅做软删除；删除资料时同步软删当前有效的归属关系和附件关系
9. 不引入新依赖；现有 FastAPI / SQLAlchemy / Pydantic / pytest 足够完成本 Story

### 推荐 API 范围

- `POST /api/v1/products/documents`：创建资料
- `GET /api/v1/products/documents`：分页列表，支持 `page`、`page_size`、`document_type`、`ownership_type`、`keyword`
- `GET /api/v1/products/documents/{id}`：获取单个资料详情
- `PATCH /api/v1/products/documents/{id}`：更新资料
- `DELETE /api/v1/products/documents/{id}`：软删除资料

### 推荐数据字段

- `product_documents`
  - `name: str`
  - `document_type: str | None`
  - `content_html: str | None`
  - `ownership_type: str`
  - `applicable_countries: list[str]`
  - `remarks: str | None`
  - 继承 `BaseModel`
- `product_document_sku_assignments`
  - `product_document_id: int`
  - `sku_id: int`
  - 继承 `BaseModel`
- `product_document_category_assignments`
  - `product_document_id: int`
  - `category_id: int`
  - 继承 `BaseModel`
- `product_document_attachments`
  - `product_document_id: int`
  - `object_key: str`
  - `file_url: str`
  - `file_name: str`
  - `sort_order: int`
  - 继承 `BaseModel`

### 接口契约建议

- 写入 Schema 应显式暴露：
  - `ownership_type`
  - `sku_ids: list[int] = []`
  - `category_ids: list[int] = []`
  - `applicable_countries: list[str] = []`
  - `attachments: list[ProductDocumentAttachmentInput] = []`
- 读取 Schema 建议返回：
  - `ownership_type`
  - `ownership_summary`
  - `sku_ids`
  - `category_ids`
  - `applicable_countries`
  - `attachments`

### 测试重点

- 创建通用资料成功，且 `sku_ids` / `category_ids` / `attachments` / `applicable_countries` 契约稳定
- 仅填写富文本内容也可创建成功
- 仅填写附件也可创建成功
- 内容与附件都为空时返回 400：`"资料内容和资料文件至少填写一项"`
- `ownership_type=指定SKU` 且 `sku_ids=[]` 返回 400
- `ownership_type=按分类` 且 `category_ids=[]` 返回 400
- 指定 SKU / 分类存在性校验生效
- 多附件创建与更新后顺序稳定、数据完整
- 商务部/财务部写接口返回 403，但读接口可访问
- 列表支持资料类型、归属类型、关键词筛选
- 删除后列表不再返回该资料

### References

- `_bmad-output/planning-artifacts/epics.md`（Epic 6 / Story 6.1）
- `_bmad-output/planning-artifacts/prd-product-management.md`（五、产品资料库管理；FR15-FR17）
- `_bmad-output/planning-artifacts/architecture.md`（产品资料模块分层与 5-file backend 结构）
- `_bmad-output/implementation-artifacts/4-1-sku-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/4-3-sku-产品图片上传.md`
- `_bmad-output/implementation-artifacts/5-1-证书数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/5-3-证书管理前端页面.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Dev Agent Record

### Debug Log

- 2026-04-21: create-story 完成，已结合 Epic 6、PRD、Architecture、4.1 / 4.3 / 5.1 / 5.3 既有模式补全 6.1 开发上下文
- 2026-04-21: 明确本 Story 仅做产品资料数据底座与 CRUD API，不提前实现 FAQ、资料前端页或 SKU 详情聚合展示
- 2026-04-21: 新增 `ProductDocument` 主表、SKU / 分类归属关系表、附件关系表，并完成 Alembic `0008_create_product_documents_tables.py`
- 2026-04-21: 落地 `schemas/repositories/services/routers` 五件套，注册 `/api/v1/products/documents` CRUD API
- 2026-04-21: 完成资料内容 / 附件至少一项校验、指定 SKU / 按分类归属校验、适用国家/地区归一化与附件对象键校验
- 2026-04-21: 新增资料服务与路由测试，并通过 `bash scripts/backend-test.sh` 全量后端回归，107/107 通过

### Completion Notes

- 已生成 6.1 故事上下文，供 `dev-story` 直接实施
- 已完成 `POST /api/v1/products/documents`、`GET /api/v1/products/documents`、`GET /api/v1/products/documents/{id}`、`PATCH /api/v1/products/documents/{id}`、`DELETE /api/v1/products/documents/{id}`
- 已支持产品资料主记录、SKU / 分类归属关系、多文件附件关系、适用国家/地区与归属摘要输出
- 已实现资料内容和附件至少一项、指定 SKU 必填、按分类必填、附件对象键 / URL 匹配等核心规则
- 已复用现有 MinIO / 预签名上传底座，资料附件保持 `object_key` / `file_url` / `file_name` 稳定契约
- 已完成 Story 6.1 开发与测试，当前状态可进入 code review
- 残余风险：当前测试未覆盖真实 MySQL 上的 Alembic 升级链；合并前建议在 MySQL 环境执行一次 `alembic upgrade head`

### File List

- `_bmad-output/implementation-artifacts/6-1-产品资料数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `erp-backend/alembic/versions/0008_create_product_documents_tables.py`
- `erp-backend/app/main.py`
- `erp-backend/app/models/__init__.py`
- `erp-backend/app/models/product_document.py`
- `erp-backend/app/repositories/product_documents.py`
- `erp-backend/app/routers/product_documents.py`
- `erp-backend/app/schemas/product_document.py`
- `erp-backend/app/services/product_documents.py`
- `erp-backend/tests/routers/test_product_documents.py`
- `erp-backend/tests/services/test_product_documents.py`

### Change Log

- 2026-04-21: 初始创建 Story 6.1 implementation artifact，并进入开发
- 2026-04-21: 完成产品资料数据模型、CRUD API、归属关系、多文件附件、适用国家/地区、测试与迁移实现，并将 Story 状态更新为 `review`
