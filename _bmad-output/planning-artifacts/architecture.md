---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowStatus: complete
lastStep: 8
completedAt: '2026-04-13'
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief.md
  - _bmad-output/planning-artifacts/prd-product-management.md
workflowType: 'architecture'
project_name: 'cross-border-erp'
user_name: '周雪'
date: '2026-04-13'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

---

## 项目上下文分析

### 需求概览

**功能需求：**

已加载 37 条功能需求（FR1-FR37），分布在 9 个子模块：

| 子模块 | FR 范围 | 架构含义 |
|--------|---------|---------|
| 分类管理 | FR1-4 | 树形结构数据模型，级联约束 |
| SPU 管理 | FR5-8 | 主实体 + 子表（开票信息），唯一性约束 |
| SKU 管理 | FR9-14 | 继承逻辑、字段级权限、多图上传、状态机 |
| 资料库 | FR15-17 | 多归属模型（通用/指定SKU/按分类）、文件存储 |
| 证书管理 | FR18-21 | 多归属模型、定时到期检测、历史记录保留 |
| FAQ 管理 | FR22-23 | 简单 CRUD，多级归属 |
| 价格管理 | FR24-27 | 审批工作流、版本化价格、字段级可见性 |
| 数据导入 | FR28-31 | Excel 批量处理、异步校验、错误报告 |
| 搜索与权限 | FR32-37 | 多维度筛选、RBAC + 字段级权限、枚举管理 |

产品模块是整个 ERP 的**主数据中台**，销售、采购、仓储、发运、报关全部依赖其 SKU 主数据。

**全系统功能模块（产品简报）：**

系统共 10 个模块，核心履约链路：

```
销售订单 → 发货需求 → 采购（2种模式）→ 仓储（质检/入库/出库）→ 发运 → 报关
```

跨模块数据流：产品管理 → 销售订单 / 采购 / 仓储 / 发运报关，财务模块 → 产品管理（价格只读展示）。

**非功能需求（驱动架构决策的关键 NFR）：**

| NFR 类型 | 指标 | 架构影响 |
|---------|------|---------|
| 性能 | 列表/详情页 P95 <2s；SKU 聚合查询 P95 <3s | 聚合查询需优化（索引/缓存），APM 监控接入 |
| Excel 导入 | 1000 条 <30s，提供进度反馈 | 需异步处理或流式处理，任务状态跟踪 |
| 并发用户 | 20 名内部用户同时在线 | 无需高并发架构，标准 Web 服务即可满足 |
| 数据规模基线 | SKU ≥ 10,000 条 | 合理索引设计，分页规范 |
| 安全性 | HTTPS、RBAC、字段级可见性、操作审计日志 | 权限中间件、审计日志表/服务 |
| 可靠性 | 工作时间 99%，每日备份，7天恢复 | 数据库备份策略，部署高可用（主备） |
| 可用性 | 中文界面 | 无国际化需求，简化前端 i18n |

### 规模与复杂度

- **项目类型**：B2B 企业内部 Web ERP（单租户）
- **复杂度**：高
- **主要技术域**：全栈 Web 应用（前端 SPA + 后端 REST API + 关系型数据库）
- **估计架构组件数**：~15 个（产品模块 7 子模块 + 全系统 10 个模块的共享基础设施）

复杂度来源：
- 多实体深度关联（分类树 → SPU → SKU → 证书/资料/FAQ/价格，5层关联）
- 字段级 RBAC 权限（报关信息、采购价、销售价按角色控制）
- 审批工作流（价格变更）
- 证书到期定时检测（后台任务）
- Excel 批量导入（校验+异步处理）
- 复杂聚合查询（SKU 详情页跨 5 类数据聚合）

### 技术约束与依赖

- 单租户内部系统，无多租户隔离需求
- SKU 编码/SPU 编码创建后不可修改，影响数据变更规则设计
- 未来集成点：CRM API（二期）、金蝶财务系统（三期），需预留扩展接口
- 文件存储：产品图片、证书文件、资料文件，需规划对象存储方案
- 开发方式：AI 辅助开发为主，架构规则需格外清晰以保证实现一致性

### 横切关注点

1. **认证与 RBAC**（含字段级权限）—— 所有模块共享
2. **审计日志**（价格变更、产品下架等关键操作）
3. **文件存储与管理**（图片、证书、资料）
4. **定时任务**（证书到期检测，每日/每小时调度）
5. **模块间数据契约**（产品主数据作为下游模块的共享引用源）
6. **多币种处理**（销售/采购/汇率换算）
7. **数据完整性保护**（不可变字段、引用完整性、级联约束）

---

## 启动模板评估

### 主要技术域

全栈 Web 应用，前后端分离架构：前端 SPA（React）+ 后端 REST API（Python）+ 关系型数据库（MySQL）

### 选定方案：Vite + React + TypeScript（前端）/ FastAPI + Python（后端）

**为何选择 Vite+React 而非 Next.js：**
内部 ERP 无 SEO 需求，后端为 Python 独立 API，SSR/Next.js API Routes 对本项目无实际价值，纯 SPA 架构部署更简单、AI 辅助实现一致性更高。

**为何选择 FastAPI 而非 Django：**
FastAPI 类型注解驱动（Pydantic v2），自动生成 OpenAPI 文档，异步原生支持，适合 AI 辅助开发，代码行为显式可预测。

**前端初始化命令：**
```bash
npm create vite@latest erp-frontend -- --template react-ts
cd erp-frontend && npm install
```

**后端初始化：**
```bash
mkdir erp-backend && cd erp-backend
python -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn sqlalchemy alembic pymysql pydantic-settings python-jose passlib bcrypt
```

### 启动模板确立的架构决策

**语言与运行时：** TypeScript（严格模式）+ React 19 + Vite 6 / Python 3.12+ + FastAPI + Pydantic v2

**后端项目结构：**
```
erp-backend/
├── app/
│   ├── main.py              # FastAPI app 入口
│   ├── core/config.py       # 配置（环境变量）
│   ├── core/security.py     # JWT、密码哈希
│   ├── db/base.py           # SQLAlchemy Base
│   ├── db/session.py        # 数据库会话依赖
│   ├── models/              # SQLAlchemy ORM 模型
│   ├── schemas/             # Pydantic DTO（请求/响应）
│   ├── routers/             # 路由（每模块一个文件）
│   ├── services/            # 业务逻辑层
│   ├── repositories/        # 数据访问层（CRUD）
│   └── deps.py              # 依赖注入
├── alembic/                 # 数据库迁移
├── tests/
└── requirements.txt
```

**前端项目结构：**
```
erp-frontend/src/
├── api/                     # API 请求封装（按模块）
├── components/              # 通用 UI 组件
├── features/                # 业务功能模块（feature-based）
│   └── products/
│       ├── components/
│       ├── hooks/
│       └── pages/
├── hooks/                   # 全局 hooks
├── stores/                  # 状态管理（Zustand）
├── types/                   # TypeScript 类型定义
└── utils/                   # 工具函数
```

**UI 组件库：** Ant Design（主要 UI 库，ERP 表格/表单场景）+ Tailwind CSS（布局辅助）
**ORM/迁移：** SQLAlchemy 2.x（异步）+ Alembic
**测试框架：** pytest + pytest-asyncio（后端）/ Vitest + React Testing Library（前端）
**开发环境：** Docker Compose（前端 dev server + FastAPI + MySQL）

**说明：** 项目初始化（骨架搭建、Docker Compose 配置）应作为第一个实现 Story。

---

## 核心架构决策

### 决策优先级分析

**关键决策（阻塞实现）：**
- 认证方式：JWT HTTP-only Cookie（access 30min + refresh 7天）
- RBAC 实现：代码定义角色权限矩阵 + FastAPI Dependency 注入
- 文件存储：阿里云 OSS（生产）/ MinIO（本地开发）
- API 规范：统一响应格式、分页格式、错误格式

**重要决策（影响架构）：**
- 删除策略：软删除（核心业务实体均加 `deleted_at`）
- 审计日志：独立 `audit_logs` 表，Service 层写入
- 背景任务：APScheduler（嵌入 FastAPI 进程）
- 前端服务端状态：TanStack Query v5
- 表单验证：React Hook Form + Zod

**延后决策（MVP 后）：**
- Celery + Redis（如背景任务复杂度上升）
- APM 工具接入（满足性能指标时引入）

### 数据架构

| 决策 | 选择 | 理由 |
|------|------|------|
| 数据库 | MySQL 8.x | 用户指定，关系型，支持复杂 JOIN |
| ORM | SQLAlchemy 2.x（async） | 类型安全，async 支持，与 FastAPI 深度集成 |
| 迁移 | Alembic | SQLAlchemy 官方迁移工具，自动生成迁移脚本 |
| 删除策略 | 软删除（`deleted_at DATETIME NULL`） | ERP 合规场景，核心业务实体数据需保留可追溯 |
| 审计日志 | 独立 `audit_logs` 表 | 结构清晰，支持跨表审计查询 |
| 背景任务 | APScheduler 内嵌 FastAPI | 轻量，适合 20 用户规模，无需额外服务 |
| 缓存 | 暂不引入，查询优化靠索引 | 规模不需要，避免过早复杂化 |

### 认证与安全

| 决策 | 选择 | 理由 |
|------|------|------|
| 认证方式 | JWT（HTTP-only Cookie） | 防 XSS，内部系统适合 |
| Token 有效期 | Access 30min / Refresh 7天 | 安全与体验平衡 |
| RBAC 模式 | 代码定义 4 角色权限矩阵 | PRD 角色固定，数据库动态 RBAC 过度设计 |
| 字段级权限 | 不同角色对应不同 Pydantic Response Schema | 敏感字段（采购价/销售价）按角色过滤 |
| 密码哈希 | bcrypt | 行业标准 |
| HTTPS | Nginx 层 TLS 终止 | 生产强制，开发 HTTP |

**4 个角色及权限矩阵：** 产品部 / 商务部 / 财务部 / 管理员（详见 PRD 十、权限设计）

### API 与通信规范

**URL 规范：** `/api/v1/{resource}` 复数形式

**统一响应格式：**
```json
// 成功（列表）
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 20
}

// 成功（单项）
{ "id": 1, ... }  // 直接返回对象

// 错误
{
  "code": "VALIDATION_ERROR",
  "message": "请求参数错误",
  "details": [{"field": "sku_code", "msg": "SKU编码已存在"}]
}
```

**文件存储：** 阿里云 OSS（生产）/ MinIO（本地开发），后端生成预签名上传 URL，前端直传 OSS

**日期格式：** API 统一使用 ISO 8601 字符串（`2026-04-13T08:00:00+08:00`）

### 前端架构

| 决策 | 选择 | 理由 |
|------|------|------|
| 服务端状态 | TanStack Query v5 | 自动缓存、失效、加载状态管理 |
| 客户端状态 | Zustand | 轻量，适合 UI 全局状态（当前用户、侧边栏等） |
| 表单 | React Hook Form + Zod | 性能好，类型安全，前后端可共享 schema |
| UI 组件库 | Ant Design 5.x | ERP 场景复杂表格/表单/级联选择开箱即用，中文生态 |
| 路由 | React Router v6 | 标准 SPA 路由 |
| HTTP 客户端 | Axios | 拦截器处理 token 刷新、错误统一处理 |

### 基础设施与部署

| 决策 | 选择 | 理由 |
|------|------|------|
| 部署方式 | Docker Compose 单机（一期） | 20 人内部系统，阿里云 ECS 单机足够 |
| 反向代理 | Nginx | 静态文件服务 + FastAPI 反代 + TLS 终止 |
| CI/CD | GitHub Actions | 自动运行测试 + build Docker image |
| 日志 | Python structlog + Nginx access log | 结构化日志，便于问题排查 |
| 监控 | FastAPI middleware 记录请求耗时 | 满足 P95 自测需求，暂不引入 APM |

### 决策影响分析

**实现顺序：**
1. Docker Compose 环境搭建（所有后续工作的基础）
2. 认证/RBAC 基础设施（所有模块依赖）
3. 文件存储集成（产品图片/证书/资料模块依赖）
4. 产品管理模块（核心主数据，其他模块依赖）
5. 其他业务模块

**跨组件依赖：**
- 软删除 → 所有 SQLAlchemy Model 需继承统一 `SoftDeleteMixin`
- RBAC → 所有 Router 通过 `Depends(require_role(...))` 注入权限检查
- 审计日志 → 所有 Service 写操作调用统一 `audit_service.log()` 方法
- TanStack Query → 所有前端数据获取统一使用 `useQuery` / `useMutation`

---

## 实现模式与一致性规则

### 命名规范

**数据库命名（Python/SQLAlchemy）：**
- 表名：`snake_case` 复数（`product_categories`、`sku_items`、`audit_logs`）
- 列名：`snake_case`（`created_at`、`deleted_at`、`spu_code`）
- 外键列名：`{entity}_id`（`spu_id`、`category_id`）
- 索引命名：`idx_{table}_{column}`（`idx_skus_spu_id`）
- 唯一约束：`uq_{table}_{column}`（`uq_skus_sku_code`）

**API 端点命名（FastAPI）：**
- 资源路径：`/api/v1/{resource}` 复数（`/api/v1/skus`、`/api/v1/products/categories`）
- 路径参数：`/{id}` 整数（`/api/v1/skus/{sku_id}`）
- 查询参数：`snake_case`（`?page_size=20&spu_id=1`）

**JSON 字段命名：** API 请求/响应统一 `snake_case`；前端内部变量 `camelCase`；Axios 响应不做自动转换，前端 API 层手动映射。

**代码命名（Python 后端）：** 文件名 `snake_case`；类名 `PascalCase`；函数/变量 `snake_case`；常量 `UPPER_SNAKE_CASE`

**代码命名（TypeScript 前端）：** 组件文件 `PascalCase.tsx`；非组件文件 `camelCase.ts`；类型/接口 `PascalCase`；hooks `use` 前缀；Zustand stores `use` 前缀

### 结构规范

**后端每个业务模块必须包含：**
```
app/
├── models/{module}.py        # SQLAlchemy ORM 模型
├── schemas/{module}.py       # Pydantic 请求/响应 Schema
├── routers/{module}.py       # FastAPI 路由（薄层）
├── services/{module}.py      # 业务逻辑（核心）
└── repositories/{module}.py  # 数据库 CRUD
```

**前端 feature-based 模块结构：**
```
src/features/{module}/
├── pages/          # 页面组件（路由挂载点）
├── components/     # 模块内组件
├── hooks/          # TanStack Query 封装
└── types.ts        # 模块内类型定义
```

**测试文件位置：** 后端 `tests/` 镜像 `app/` 结构；前端与源文件同目录 `*.test.tsx`

### 格式规范

**API 统一响应格式：**
```python
# 列表响应
class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int

# 错误响应
class ErrorResponse(BaseModel):
    code: str        # 大写下划线：VALIDATION_ERROR, NOT_FOUND, FORBIDDEN
    message: str     # 中文，面向用户
    details: list[dict] | None = None
```

**HTTP 状态码规范：** 200 成功 / 201 创建 / 204 删除 / 400 业务错误 / 401 未登录 / 403 无权限 / 404 不存在 / 422 参数格式错误 / 500 服务器错误

**日期时间：** 数据库存 UTC，API 响应带时区（`+08:00`），前端显示转换本地时间。

### TanStack Query Key 规范

```typescript
// 格式：['模块', '操作', 参数对象]
['skus', 'list', { page: 1, spu_id: 2 }]
['skus', 'detail', skuId]
['certificates', 'list', { status: 'expiring' }]
['prices', 'detail', skuId]
```

### 错误处理规范

**后端：** 统一自定义 `BusinessError` 异常 → 全局 exception handler 转 `ErrorResponse`；Router 层不做 try/catch；Service 层抛 `BusinessError`。

**前端：** TanStack Query 全局 `onError` 回调统一处理；组件层通过 `isError` 状态展示错误 UI；表单通过 `mutation.error` 获取错误。

**软删除强制规则：** 通过 SQLAlchemy Mixin 自动过滤 `deleted_at IS NULL`，禁止在单个 Repository 方法中手动添加软删除过滤。

### AI Agent 强制规则

1. 新增后端业务模块**必须**创建 model / schema / router / service / repository 五个文件
2. 所有 SQLAlchemy Model **必须**继承 `BaseModel`（含 `id`、`created_at`、`updated_at`、`deleted_at`）
3. 所有删除操作**必须**软删除，禁止物理删除核心业务数据
4. 所有 Router **必须**通过 `Depends()` 注入权限检查
5. 前端所有 API 调用**必须**通过 TanStack Query，禁止组件内直接 `axios.get()`
6. 前端组件**禁止**直接修改服务端数据状态，必须通过 `mutation.mutate()` + Query invalidation
7. 所有 API 响应**必须**符合统一格式（`PaginatedResponse` / `ErrorResponse`）

---

## 项目结构与边界

### 需求到结构的映射

| PRD 功能模块 | 后端模块路径 | 前端功能路径 |
|------------|------------|------------|
| 分类管理（FR1-4） | `app/*/product_categories.*` | `features/products/categories/` |
| SPU 管理（FR5-8） | `app/*/spus.*` | `features/products/spus/` |
| SKU 管理（FR9-14） | `app/*/skus.*` | `features/products/skus/` |
| 产品资料库（FR15-17） | `app/*/product_documents.*` | `features/products/documents/` |
| 证书管理（FR18-21） | `app/*/certificates.*` | `features/products/certificates/` |
| FAQ 管理（FR22-23） | `app/*/faqs.*` | `features/products/faqs/` |
| 价格管理（FR24-27） | `app/*/prices.*` | `features/prices/` |
| 数据导入（FR28-31） | `app/*/import_tasks.*` | `features/products/import/` |
| 认证/RBAC | `app/core/security.py` + `app/*/users.*` | `features/auth/` |
| 审计日志 | `app/*/audit_logs.*` + `app/core/audit.py` | — |
| 文件上传 | `app/core/storage.py` | `utils/upload.ts` |
| 枚举管理（FR37） | `app/*/enums.*` | `features/admin/enums/` |

**枚举管理补充约束：**
- `country_region` 应作为系统级枚举组纳入枚举管理，供价格区域、资料适用国家/地区、SPU 禁止经营国家等字段统一复用
- 国家/地区类业务字段优先提交并存储标准编码（如 `CN`、`US`、`GLOBAL`），展示文案由枚举配置解析，不应把自由文本名称作为长期主数据来源
- `GLOBAL` 作为内置业务特殊值保留，即使后续开放枚举配置，也应默认存在且不可删除

### 完整项目目录结构

```
cross-border-erp/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── erp-backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── .env.example
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── main.py
│   │   ├── deps.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   ├── permissions.py
│   │   │   ├── audit.py
│   │   │   ├── storage.py
│   │   │   ├── scheduler.py
│   │   │   └── exceptions.py
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   └── session.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── users.py
│   │   │   ├── product_categories.py
│   │   │   ├── spus.py
│   │   │   ├── skus.py
│   │   │   ├── certificates.py
│   │   │   ├── product_documents.py
│   │   │   ├── faqs.py
│   │   │   ├── prices.py
│   │   │   ├── import_tasks.py
│   │   │   ├── audit_logs.py
│   │   │   └── enums.py
│   │   ├── schemas/
│   │   │   ├── common.py
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── product_categories.py
│   │   │   ├── spus.py
│   │   │   ├── skus.py
│   │   │   ├── certificates.py
│   │   │   ├── product_documents.py
│   │   │   ├── faqs.py
│   │   │   ├── prices.py
│   │   │   ├── import_tasks.py
│   │   │   └── enums.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── product_categories.py
│   │   │   ├── spus.py
│   │   │   ├── skus.py
│   │   │   ├── certificates.py
│   │   │   ├── product_documents.py
│   │   │   ├── faqs.py
│   │   │   ├── prices.py
│   │   │   ├── import_tasks.py
│   │   │   ├── files.py
│   │   │   └── enums.py
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── product_category_service.py
│   │   │   ├── spu_service.py
│   │   │   ├── sku_service.py
│   │   │   ├── certificate_service.py
│   │   │   ├── document_service.py
│   │   │   ├── faq_service.py
│   │   │   ├── price_service.py
│   │   │   ├── import_service.py
│   │   │   └── enum_service.py
│   │   └── repositories/
│   │       ├── base_repository.py
│   │       ├── user_repository.py
│   │       ├── product_category_repository.py
│   │       ├── spu_repository.py
│   │       ├── sku_repository.py
│   │       ├── certificate_repository.py
│   │       ├── document_repository.py
│   │       ├── faq_repository.py
│   │       ├── price_repository.py
│   │       └── import_repository.py
│   └── tests/
│       ├── conftest.py
│       ├── services/
│       │   ├── test_sku_service.py
│       │   ├── test_certificate_service.py
│       │   └── test_price_service.py
│       └── routers/
│           ├── test_skus.py
│           └── test_auth.py
│
└── erp-frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── index.html
    ├── .env.example
    ├── public/
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/
        │   ├── client.ts
        │   ├── auth.ts
        │   ├── skus.ts
        │   ├── spus.ts
        │   ├── categories.ts
        │   ├── certificates.ts
        │   ├── documents.ts
        │   ├── faqs.ts
        │   ├── prices.ts
        │   └── enums.ts
        ├── components/
        │   ├── layout/
        │   │   ├── AppLayout.tsx
        │   │   └── PageHeader.tsx
        │   ├── ui/
        │   │   ├── ConfirmModal.tsx
        │   │   ├── FileUpload.tsx
        │   │   ├── StatusTag.tsx
        │   │   └── AuditInfo.tsx
        │   └── form/
        │       ├── CategoryCascader.tsx
        │       └── SKUSelector.tsx
        ├── features/
        │   ├── auth/
        │   │   ├── pages/LoginPage.tsx
        │   │   └── hooks/useAuth.ts
        │   ├── products/
        │   │   ├── categories/
        │   │   │   ├── pages/CategoryPage.tsx
        │   │   │   └── hooks/useCategories.ts
        │   │   ├── spus/
        │   │   │   ├── pages/SPUListPage.tsx
        │   │   │   ├── pages/SPUDetailPage.tsx
        │   │   │   ├── pages/SPUFormPage.tsx
        │   │   │   ├── components/SPUTable.tsx
        │   │   │   └── hooks/useSPUs.ts
        │   │   ├── skus/
        │   │   │   ├── pages/SKUListPage.tsx
        │   │   │   ├── pages/SKUDetailPage.tsx
        │   │   │   ├── pages/SKUFormPage.tsx
        │   │   │   ├── components/SKUTable.tsx
        │   │   │   ├── components/SKUDetailTabs.tsx
        │   │   │   ├── components/SKUInheritedFields.tsx
        │   │   │   └── hooks/useSKUs.ts
        │   │   ├── certificates/
        │   │   │   ├── pages/CertificateListPage.tsx
        │   │   │   ├── components/CertificateStatusBadge.tsx
        │   │   │   └── hooks/useCertificates.ts
        │   │   ├── documents/
        │   │   │   └── pages/DocumentListPage.tsx
        │   │   ├── faqs/
        │   │   │   └── pages/FAQListPage.tsx
        │   │   └── import/
        │   │       └── pages/ImportPage.tsx
        │   ├── prices/
        │   │   ├── pages/PriceListPage.tsx
        │   │   ├── pages/PriceFormPage.tsx
        │   │   └── hooks/usePrices.ts
        │   └── admin/
        │       └── enums/
        │           └── pages/EnumConfigPage.tsx
        ├── hooks/
        │   └── usePermission.ts
        ├── stores/
        │   ├── authStore.ts
        │   └── uiStore.ts
        ├── types/
        │   ├── api.ts
        │   ├── product.ts
        │   └── auth.ts
        └── utils/
            ├── format.ts
            └── upload.ts
```

### 架构边界

**API 边界：**
- 公开端点：`/api/v1/auth/login`（唯一无需认证）
- 认证端点：所有其他 `/api/v1/*`（JWT Cookie 验证）
- 文件上传：`/api/v1/files/presigned-url` → 前端直传 OSS
- 未来 CRM：预留 `/api/v1/external/` 前缀（二期）

**数据边界：**
- 主数据层：分类/SPU/SKU — 被所有模块引用，变更受严格约束
- 不可变字段：`spu_code`、`sku_code` — 数据库层唯一约束 + Service 层拦截
- 软删除过滤：SQLAlchemy Mixin 自动应用，应用层透明
- 字段级权限：多 Pydantic Schema 实现，非数据库层控制

**数据流：**
```
前端（TanStack Query）
  → Axios（HTTP-only Cookie / credentials: include）
    → Nginx（TLS 终止）
      → FastAPI（权限检查 → Service → Repository）
        → MySQL（SQLAlchemy async）

文件上传：前端 → 后端获取预签名 URL → 前端直传 OSS → 后端记录 URL
```

### 集成点

**内部集成：** 产品管理模块为一期唯一业务模块，后续模块通过 SKU Repository 读取主数据。

**外部集成：**
- 阿里云 OSS（`app/core/storage.py` 封装）
- 金蝶财务（三期，预留 `app/core/external_api.py`）

---

## 架构验证结果

### 一致性验证

| 技术组合 | 状态 | 说明 |
|---------|------|------|
| FastAPI + SQLAlchemy 2.x async + MySQL | 兼容 | asyncmy/aiomysql 驱动完整支持 |
| FastAPI + Pydantic v2 | 兼容 | FastAPI 0.100+ 原生支持 |
| Vite 6 + React 19 + TypeScript | 兼容 | 官方支持 |
| Ant Design 5.x + Tailwind CSS | 兼容，需配置 | tailwind.config.ts 设置 `important: '#root'` 解决样式优先级 |
| TanStack Query v5 + React 19 | 兼容 | 官方支持 React 18+/19 |
| APScheduler 3.x + FastAPI async | 兼容 | asyncio 调度器在 lifespan 事件中启动 |

### 需求覆盖验证

**FR1-FR37 全部覆盖：**

| FR 类别 | 架构支持 |
|---------|---------|
| FR1-4 分类管理 | `product_category_service` + 树形数据 API |
| FR5-8 SPU 管理 | `spu_service` + 子表 `spu_invoice_infos` |
| FR9-14 SKU 管理 | `sku_service` + 继承逻辑 + 字段级 Pydantic Schema |
| FR15-17 资料库 | `document_service` + OSS 文件上传 |
| FR18-21 证书管理 | `certificate_service` + APScheduler 到期检测 |
| FR22-23 FAQ | `faq_service` |
| FR24-27 价格管理 | `price_service` + 审批流（Service 层实现） |
| FR28-31 数据导入 | `import_service` + 批量写入 + 进度状态表 |
| FR32-34 搜索筛选 | SQLAlchemy 动态 where + 枚举状态过滤 |
| FR35-37 RBAC/枚举 | `permissions.py` + 多 Schema + `enums_service` |

**FR35-37 枚举复用补充：**
- `enums_service` 除单位、产品类型、证书类型、资料类型、币种外，还应统一承载 `country_region`
- 前端业务表单对国家/地区字段应统一消费枚举接口，不在各页面分别维护独立常量或手工名单
- 若历史业务表已同时保存 `country_code` 与 `country_name`，后续应以 `country_code` 为准逐步收口，`country_name` 仅作为兼容展示字段

**NFR 全部覆盖：** 性能（索引 + selectinload 避免 N+1）/ 安全（JWT Cookie + RBAC + 审计日志）/ 可靠性（Docker 自动重启 + MySQL 每日备份）/ 可用性（中文界面，无 i18n 需求）

### 架构完整性检查清单

- [x] 项目上下文完整分析
- [x] 规模与复杂度评估
- [x] 技术约束已识别，横切关注点已映射
- [x] 关键决策已记录（含版本）
- [x] 技术栈完整指定，集成模式已定义
- [x] 命名规范、结构规范、API 格式、错误处理、软删除、审计日志已明确
- [x] AI Agent 强制规则 7 条已列出
- [x] 完整目录结构已定义，需求到结构映射完整
- [x] 架构一致性已验证，无关键缺口

### 架构就绪评估

**整体状态：可以开始实现**

**信心级别：高**

**架构优势：**
- 前后端清晰分离，AI Agent 实现边界明确
- 五层后端结构（router / service / repository / model / schema）高度一致可预测
- 软删除 + 审计日志通过 Mixin 统一处理，不依赖 Agent 自觉执行
- Feature-based 前端结构，新增模块不影响已有代码

**后期增强方向（MVP 后）：**
- Redis 缓存（当聚合查询超出 P95 指标时）
- Celery（当后台任务复杂度超出 APScheduler 能力时）
- CRM API 接入（二期）/ 金蝶财务推送（三期）

### 实现交接

**AI Agent 指引：**
- 严格遵循本文档所有架构决策
- 新增任何模块前先确认目录结构中是否已有对应位置
- 所有代码必须符合「实现模式与一致性规则」章节的规范
- 遇到架构问题以本文档为准，不自行发明新模式

**第一个实现 Story 应包含：**
```bash
# 1. 初始化前端
npm create vite@latest erp-frontend -- --template react-ts

# 2. 初始化后端目录结构
mkdir erp-backend && cd erp-backend && python -m venv .venv

# 3. 创建 docker-compose.yml（nginx + fastapi + mysql）

# 4. 定义 app/db/base.py（BaseModel Mixin：id/created_at/updated_at/deleted_at）

# 5. 定义 app/core/permissions.py（角色权限矩阵）

# 6. 定义 app/core/exceptions.py（BusinessError + 全局 handler）

# 7. 定义 app/schemas/common.py（PaginatedResponse / ErrorResponse）
```
