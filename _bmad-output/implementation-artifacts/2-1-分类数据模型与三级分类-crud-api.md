# Story 2.1: 分类数据模型与三级分类 CRUD API

**Status:** done
**Story Key:** 2-1-分类数据模型与三级分类-crud-api
**Epic:** 2 - 产品分类管理
**Date:** 2026-04-16

---

## User Story

As a 产品部用户,
I want 创建和编辑三级产品分类（一级/二级/三级），并维护层级关系,
So that 产品分类体系建立后，SPU 和 SKU 可以正确关联到分类。

---

## Acceptance Criteria

**Given** `product_categories` 表已创建（含 `code`, `name`, `level`, `parent_id`, `sort_order` 字段）  
**When** 产品部用户调用 `POST /api/v1/products/categories` 创建一级分类  
**Then** 分类创建成功，`level=1`，`parent_id=null`  
**And** 分类编码全局唯一

**Given** 一级分类已存在  
**When** 产品部用户创建二级分类并指定 `parent_id` 为该一级分类  
**Then** 二级分类创建成功，`level=2`  
**And** 三级分类同理，`parent_id` 指向二级分类

**Given** 分类已创建  
**When** 尝试修改分类编码  
**Then** 返回 400 错误：`"分类编码创建后不可修改"`（FR4）

**Given** 分类下已有 SPU 关联  
**When** 尝试删除该分类  
**Then** 返回 400 错误：`"该分类下已有产品关联，无法删除"`（FR3）

**Given** 产品部用户调整同级分类的排序  
**When** 调用排序 API 传入新的 `sort_order`  
**Then** 同级分类按新排序展示（FR2）

**Given** 商务部用户尝试创建分类  
**When** 调用 `POST /api/v1/products/categories`  
**Then** 返回 403 Forbidden（商务部对分类管理仅有只读权限）

---

## Scope

### In Scope

- 后端 `product_categories` 数据模型与 Alembic 迁移
- 分类模块 5-file backend 结构落地：model / schema / repository / service / router
- 分类树读取 API（供后续前端树形结构与级联选择复用）
- 分类创建、更新、删除、排序 API
- RBAC 集成：产品部/管理员可写，商务部/财务部只读
- 最小可用后端测试：模型约束、权限校验、层级校验、编码不可改、排序、删除保护

### Out of Scope

- 分类管理前端页面、树拖拽 UI、右侧编辑表单 → Story 2.2
- SPU、SKU 实体与真实分类关联写入 → Story 3.x / 4.x
- Excel 导入分类 → Epic 8
- 枚举配置、通用级联组件封装 → 后续相关 Story

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-1 | done | FastAPI / SQLAlchemy / Alembic / Docker 基础设施已就绪 |
| 1-2 | done | 用户登录、Cookie 认证、`get_current_user` 已可用 |
| 1-3 | done | `require_product_or_admin` 等 RBAC 依赖已可复用 |
| 1-4 | done | 前端分类页面占位路由已存在，后续 2.2 可直接接入 |
| 1-5 | done | 通用前端组件已具备，后续 2.2 可复用 |
| 1-6 | done | CI / 审计 / 开发工作流已稳定 |

---

## 实施任务建议

- [x] Task 1: 分类数据模型与迁移
  - [x] 新增 `erp-backend/app/models/product_category.py`
  - [x] 在 `erp-backend/app/models/__init__.py` 中注册 model
  - [x] 新增 Alembic migration，创建 `product_categories` 表与必要索引/外键
  - [x] 明确 `level`、`parent_id`、`sort_order` 的字段约束与默认值

- [x] Task 2: 分类模块后端结构
  - [x] 新增 `erp-backend/app/schemas/product_category.py`
  - [x] 新增 `erp-backend/app/repositories/product_categories.py`
  - [x] 新增 `erp-backend/app/services/product_categories.py`
  - [x] 新增 `erp-backend/app/routers/product_categories.py`
  - [x] 在 `erp-backend/app/routers/__init__.py` / `app/main.py` 完成 router 注册

- [x] Task 3: 层级规则与业务约束
  - [x] 实现一级/二级/三级分类创建规则校验
  - [x] 实现分类编码全局唯一校验
  - [x] 实现分类编码创建后不可修改
  - [x] 实现同级排序更新逻辑
  - [x] 实现删除保护逻辑（至少统一放在 service 层集中处理）

- [x] Task 4: API 与权限
  - [x] 写接口使用 `require_product_or_admin`
  - [x] 读接口允许已登录用户访问（为后续只读页面复用）
  - [x] 补齐 403 / 400 / 404 等错误路径

- [x] Task 5: 测试与回归验证
  - [x] 新增分类模块测试文件（建议 `tests/routers/test_product_categories.py`）
  - [x] 覆盖层级创建成功/失败、编码不可改、删除保护、排序、权限矩阵
  - [x] 跑通后端全量 pytest
  - [x] 如需前端联调，保留 `CategoryPage` 占位，不在本 Story 扩展 UI

---

## Dev Notes

- 资源路径遵循架构约定：`/api/v1/{resource}` 复数，本 Story 使用 `/api/v1/products/categories`
- 后端目录遵循 5-file module 规范，对应文件建议命名为：
  - `app/models/product_category.py`
  - `app/schemas/product_category.py`
  - `app/repositories/product_categories.py`
  - `app/services/product_categories.py`
  - `app/routers/product_categories.py`
- 现有权限依赖可直接复用 `app/core/permissions.py` 中的 `require_product_or_admin`
- 现有统一业务异常使用 `BusinessError`，中文错误消息应直接对齐 AC / PRD 文案
- 现有基础仓储 `BaseRepository` 已支持 `get_by_id` / `get_all` / `save` / `soft_delete`

### 关键实现约束

1. 分类树最多三级，不要做成无限层级通用树
2. `code` 创建后不可改，更新 schema/service 必须显式拦截
3. `level` 不应完全信任前端传值，应由父级关系或服务端规则校验得出
4. 删除保护逻辑必须集中在 service 层，不要散落在 router
5. 读接口应优先返回树形结构，供 Story 2.2 页面与后续 SPU/SKU 级联选择复用

### 依赖风险提醒

- AC 中的 FR3 明确要求“分类下已有 SPU 关联时不可删除”，但当前 `SPU` 实体计划在 Story 3.1 才落地。
- 本 Story 开发时必须显式处理这个顺序风险，至少做到：
  - 删除保护逻辑在 service 层抽成可扩展检查点
  - 当前阶段先覆盖“有子分类不可删”的结构性保护
  - 若要严格满足“已有 SPU 关联不可删”，需在实现时确认是否同步补入最小 `SPU` 引用检查，或在开发前先与 PM/架构对齐故事顺序
- 不要把删除保护硬编码在 router，否则 Story 3.1 接入真实关联时会反复返工

### 推荐 API 范围

- `GET /api/v1/products/categories/tree`：返回完整三级分类树
- `POST /api/v1/products/categories`：创建分类
- `PATCH /api/v1/products/categories/{id}`：更新分类名称/排序等可变字段
- `DELETE /api/v1/products/categories/{id}`：删除分类（软删除或受保护删除，按实现一致性选择）
- `PATCH /api/v1/products/categories/{id}/sort`：更新同级排序

### 推荐数据字段

- `code: str`
- `name: str`
- `level: int`（仅允许 1 / 2 / 3）
- `parent_id: int | null`
- `sort_order: int`
- 继承 `BaseModel` 提供的 `id / created_at / updated_at / deleted_at`

### 测试重点

- 一级分类创建成功，`parent_id is null`
- 二级/三级分类 parent level 不匹配时返回 400
- 不允许创建四级分类
- 重复 `code` 返回 400/409（项目内保持一致即可，但错误消息必须中文清晰）
- 更新时修改 `code` 返回 400：`"分类编码创建后不可修改"`
- 商务部 / 财务部创建分类返回 403
- 排序后树接口按新的 `sort_order` 返回
- 删除时如存在子分类或未来的产品关联条件，返回 400

### 前端/后续 Story 对齐点

- 现有分类页占位文件为 `erp-frontend/src/features/products/categories/pages/CategoryPage.tsx`
- Story 2.2 预期会消费树形 API，并在页面中使用 `Cascader` / 树结构展示
- 本 Story 的返回结构要优先考虑后续树形渲染与级联选择复用，避免后续再改接口形状

### 推荐修改路径

- `erp-backend/alembic/versions/*`
- `erp-backend/app/models/product_category.py`
- `erp-backend/app/models/__init__.py`
- `erp-backend/app/schemas/product_category.py`
- `erp-backend/app/repositories/product_categories.py`
- `erp-backend/app/services/product_categories.py`
- `erp-backend/app/routers/product_categories.py`
- `erp-backend/app/main.py`
- `erp-backend/tests/routers/test_product_categories.py`

### References

- `_bmad-output/planning-artifacts/epics.md`（Epic 2 / Story 2.1）
- `_bmad-output/planning-artifacts/architecture.md`（FR1-4、目录结构、API 路径规范）
- `_bmad-output/planning-artifacts/prd-product-management.md`（分类管理、权限矩阵、字段规则）
- `_bmad-output/planning-artifacts/ux-design-specification.md`（后续 2.2 将使用 Cascader / 树结构）
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Dev Agent Record

### Debug Log

- 2026-04-16: 完成 `product_categories` 模型、迁移、schema、repository、service、router 全链路落地
- 2026-04-16: 分类树读取、层级创建校验、编码不可改、排序更新、删除保护已集中在 service 层实现
- 2026-04-16: 为测试客户端补齐与正式环境一致的 `commit/rollback` 语义，避免请求间事务不可见
- 2026-04-16: 根据 code review 反馈，将分类删除保护改为真实检查 `spus` 表中的分类关联，而非占位返回

### Completion Notes

- 已新增分类模块后端 5-file 结构，并在 `app/main.py` 注册分类 router
- 已实现 `GET /api/v1/products/categories/tree`、创建、更新、排序、删除接口
- 已实现产品部/管理员可写、已登录用户可读的权限边界
- 删除保护当前已覆盖“有子分类不可删除”，并预留 `_has_linked_products()` 扩展点以对接 Story 3.1 的 SPU 关联检查
- 后端验证完成：`bash scripts/backend-test.sh` 46/46 通过
- 已补齐“已有 SPU 关联不可删除”的真实校验，并新增带 `spus` 临时表的测试场景
- 修复后重新验证：`bash scripts/backend-test.sh` 47/47 通过
- 最终复审通过，Story 2.1 已完成并关闭

### File List

- `erp-backend/app/models/product_category.py`
- `erp-backend/app/models/__init__.py`
- `erp-backend/app/schemas/product_category.py`
- `erp-backend/app/repositories/product_categories.py`
- `erp-backend/app/services/product_categories.py`
- `erp-backend/app/routers/product_categories.py`
- `erp-backend/app/main.py`
- `erp-backend/alembic/versions/0003_create_product_categories_table.py`
- `erp-backend/tests/routers/test_product_categories.py`
- `erp-backend/tests/conftest.py`
- `_bmad-output/implementation-artifacts/2-1-分类数据模型与三级分类-crud-api.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-16: Story 创建，状态 ready-for-dev
- 2026-04-16: Story 实现完成，后端 46 个测试全部通过，状态更新为 review
- 2026-04-16: 已修复 code review 提出的删除保护缺口，并完成后端回归验证，等待再次 review
- 2026-04-16: 最终 code review 通过，Story 状态更新为 done
