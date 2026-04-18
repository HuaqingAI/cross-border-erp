# Story 4.3: SKU 产品图片上传

**Status:** review
**Story Key:** 4-3-sku-产品图片上传
**Epic:** 4 - SKU 完整管理
**Date:** 2026-04-18

---

## User Story

As a 产品部用户,
I want 为 SKU 上传多张产品图片,
So that 产品形象有图片记录，下游模块和客户沟通时可引用。

---

## Acceptance Criteria

**Given** 产品部用户在 SKU 编辑时上传图片  
**When** 调用 `POST /api/v1/files/presigned-url` 获取预签名 URL  
**Then** 返回 OSS/MinIO 预签名上传 URL 和文件 key

**Given** 前端获取到预签名 URL  
**When** 直接上传图片文件到 OSS/MinIO  
**Then** 上传成功后将文件 URL 关联到 SKU 记录（FR14）

**Given** SKU 已有多张图片  
**When** 查看 SKU 详情或编辑页  
**Then** 所有图片以缩略图列表展示  
**And** 支持删除单张图片

---

## Scope

### In Scope

- 新增通用文件预签名上传接口 `POST /api/v1/files/presigned-url`
- 实现 MinIO 预签名 PUT URL 生成与文件 URL 计算
- 新增 SKU 图片子表、图片关联接口与删除接口
- SKU 明细接口返回图片列表，为 4.5 / 4.6 直接复用
- 前端共享上传工具 `upload.ts` 从占位改为可用实现
- 最小测试覆盖：预签名接口、图片关联、图片删除、详情返回图片列表

### Out of Scope

- SKU 编辑页真实上传组件 UI → Story 4.5
- SKU 详情页真实缩略图展示 UI → Story 4.6
- 图片排序拖拽、封面图、批量删除
- OSS 正式生产配置、CDN、图片压缩与转码

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-1 | done | FastAPI / Docker / MinIO 基础设施已就绪 |
| 1-2 | done | 登录鉴权已可用 |
| 1-3 | done | `require_product_or_admin` 已可复用 |
| 4-1 | review | SKU 数据模型与详情接口已存在，可扩展图片字段 |
| 4-2 | review | SKU 报关信息接口已接入，SKU 模块读写边界已稳定 |

---

## 实施任务建议

- [x] Task 1: 文件上传底座
  - [x] 在 `erp-backend/app/core/storage.py` 实现 MinIO 预签名 URL 生成与删除
  - [x] 新增 `erp-backend/app/schemas/file.py`
  - [x] 新增 `erp-backend/app/services/files.py`
  - [x] 新增 `erp-backend/app/routers/files.py`
  - [x] 在 `erp-backend/app/main.py` 注册 files router

- [x] Task 2: SKU 图片关联能力
  - [x] 为 SKU 新增图片子表与 Alembic migration
  - [x] 在 SKU 模块中新增图片关联、删除与详情返回能力
  - [x] 新增 `POST /api/v1/skus/{id}/images`
  - [x] 新增 `DELETE /api/v1/skus/{id}/images/{image_id}`

- [x] Task 3: 前端共享上传工具
  - [x] 新增 `erp-frontend/src/api/files.ts`
  - [x] 将 `erp-frontend/src/utils/upload.ts` 从占位实现为真实上传工具

- [x] Task 4: 测试与验证
  - [x] 新增 `erp-backend/tests/routers/test_files.py`
  - [x] 在 `erp-backend/tests/routers/test_skus.py` 覆盖图片关联与删除
  - [x] 跑通后端回归与前端构建

---

## Dev Notes

### 现有代码基础

- 当前仓库没有 SKU 编辑页和详情页，只有列表占位页
- 因此 4.3 在本 Story 内以“上传与图片关联底座”方式落地，真实 UI 接入留给 4.5 / 4.6
- `erp-backend/app/core/storage.py` 和 `erp-frontend/src/utils/upload.ts` 之前均为明确占位文件，本 Story 负责填充它们

### 关键实现约束

1. 不要在 4.3 临时发明一个越过 4.5 / 4.6 的独立图片管理页
2. 图片必须作为 SKU 的独立子表记录，不要把多图 URL 直接塞进 `skus` 主表
3. 详情接口返回图片列表即可，真实缩略图渲染交由后续页面 Story 消费
4. 删除图片时同时删除 MinIO 对象，避免遗留孤儿文件
5. 预签名上传接口当前限定产品部/管理员使用，与 4.3 故事角色保持一致

### 推荐 API 范围

- `POST /api/v1/files/presigned-url`
- `POST /api/v1/skus/{id}/images`
- `DELETE /api/v1/skus/{id}/images/{image_id}`
- `GET /api/v1/skus/{id}` 返回 `images`

### References

- `_bmad-output/planning-artifacts/epics.md`（Epic 4 / Story 4.3）
- `_bmad-output/planning-artifacts/prd-product-management.md`（SKU 产品图片上传）
- `_bmad-output/planning-artifacts/ux-design-specification.md`（产品图片分区、拖拽上传区域、缩略图预览）
- `_bmad-output/implementation-artifacts/4-1-sku-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/4-2-sku-报关信息维护.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Dev Agent Record

### Debug Log

- 2026-04-18: create-story 完成，已确认当前仓库尚无 SKU 编辑页/详情页，因此 4.3 以“上传与图片关联底座”方式实施
- 2026-04-18: 完成 MinIO 预签名上传接口、SKU 图片子表、图片关联/删除接口与前端共享上传工具
- 2026-04-18: 后端验证通过，`bash scripts/backend-test.sh` 76/76 通过
- 2026-04-18: 前端构建验证通过，`npm run build` 成功

### Completion Notes

- 已新增 `POST /api/v1/files/presigned-url`，返回 MinIO 预签名 PUT URL、file key 与访问 URL
- 已新增 `POST /api/v1/skus/{id}/images`、`DELETE /api/v1/skus/{id}/images/{image_id}`
- 已在 `GET /api/v1/skus/{id}` 中返回 `images`，供 4.5 / 4.6 页面直接展示缩略图列表
- 已将 `erp-frontend/src/utils/upload.ts` 从占位改为真实上传工具
- 验证完成：`PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m compileall erp-backend/app erp-backend/tests erp-frontend/src`
- 后端验证完成：`bash scripts/backend-test.sh` 76/76 通过
- 前端验证完成：`cd erp-frontend && npm run build`

### File List

- `_bmad-output/implementation-artifacts/4-3-sku-产品图片上传.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `erp-backend/requirements.txt`
- `erp-backend/app/core/config.py`
- `erp-backend/app/core/storage.py`
- `erp-backend/app/models/__init__.py`
- `erp-backend/app/models/sku.py`
- `erp-backend/app/repositories/skus.py`
- `erp-backend/app/schemas/file.py`
- `erp-backend/app/schemas/sku.py`
- `erp-backend/app/services/files.py`
- `erp-backend/app/services/skus.py`
- `erp-backend/app/routers/files.py`
- `erp-backend/app/routers/skus.py`
- `erp-backend/app/main.py`
- `erp-backend/alembic/versions/0006_create_sku_images_table.py`
- `erp-backend/tests/routers/test_files.py`
- `erp-backend/tests/routers/test_skus.py`
- `erp-frontend/src/api/files.ts`
- `erp-frontend/src/utils/upload.ts`

### Change Log

- 2026-04-18: Story 创建并进入开发，状态更新为 in-progress
- 2026-04-18: Story 实现完成，状态更新为 review
