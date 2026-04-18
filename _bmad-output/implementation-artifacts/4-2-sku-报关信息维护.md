# Story 4.2: SKU 报关信息维护

**Status:** review
**Story Key:** 4-2-sku-报关信息维护
**Epic:** 4 - SKU 完整管理
**Date:** 2026-04-18

---

## User Story

As a 商务部用户,
I want 为 SKU 维护报关信息（HSCODE、监管条件、申报要素、退税税点）,
So that 发运/报关模块可以正确获取报关数据。

---

## Acceptance Criteria

**Given** 商务部用户调用 `PATCH /api/v1/skus/{id}/customs-info`  
**When** 提交报关信息（HSCODE、监管条件、申报要素、退税税点、是否已维护报关信息）  
**Then** 报关信息更新成功（FR12）

**Given** 产品部用户调用同一 API  
**When** 尝试修改报关信息  
**Then** 返回 403 Forbidden：`"报关信息仅商务部可编辑"`（FR12）

**Given** 产品部用户查看 SKU 详情  
**When** 获取 SKU 完整信息  
**Then** 报关信息字段可见但标记为只读（FR12）

---

## Scope

### In Scope

- 在现有 SKU 模块上新增专属报关信息更新接口 `PATCH /api/v1/skus/{id}/customs-info`
- 报关字段仅商务部/管理员可写，其他已登录角色只读
- 复用 4.1 已落地的 `customs_*` 字段，不额外新增主表字段
- 更新成功后返回最新 SKU 明细，供 4.5 / 4.6 直接复用
- 补充最小后端测试：商务部成功、产品部禁止、详情只读可见

### Out of Scope

- SKU 通用编辑表单页 → Story 4.5
- SKU 详情页聚合展示 → Story 4.6
- 报关字段的前端页面交互、只读提示文案、字段布局
- HSCODE 字典校验、海关规则库联动
- 产品图片、产品状态、列表页筛选等其他 4.x 故事

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-2 | done | 登录鉴权、Cookie 认证、`get_current_user` 已可用 |
| 1-3 | done | `require_business_or_admin` 与字段级权限辅助函数已可复用 |
| 3-1 | done | SPU 基础模型和权限边界已落地 |
| 4-1 | review | SKU 数据模型、详情接口与只读报关字段占位已就绪 |

---

## 实施任务建议

- [x] Task 1: 报关信息接口契约
  - [x] 在 `erp-backend/app/schemas/sku.py` 新增报关信息更新 payload schema
  - [x] 明确字段空值策略与更新语义（显式传 null 代表清空；未传代表保持不变）

- [x] Task 2: SKU 报关信息更新能力
  - [x] 在 `erp-backend/app/services/skus.py` 新增专属报关信息更新方法
  - [x] 在 `erp-backend/app/routers/skus.py` 新增 `PATCH /api/v1/skus/{id}/customs-info`
  - [x] 写接口使用 `require_business_or_admin`

- [x] Task 3: 测试与验证
  - [x] 在 `erp-backend/tests/routers/test_skus.py` 覆盖商务部成功更新报关信息
  - [x] 覆盖产品部调用返回 403
  - [x] 覆盖详情接口对其他角色只读可见
  - [x] 跑通后端回归测试

---

## Dev Notes

### 现有代码基础

- 4.1 已在 `skus` 表中落地以下报关字段：
  - `customs_hscode`
  - `customs_supervision_condition`
  - `customs_declaration_elements`
  - `customs_refund_tax_rate`
  - `customs_info_ready`
- 现有 SKU 明细接口已经返回上述字段，4.2 不需要扩表
- 统一错误处理继续使用 `BusinessError`
- 权限应复用 `require_business_or_admin`，不要在 router 中手写角色判断

### 关键实现约束

1. 本 Story 只新增报关信息专属更新入口，不要把报关字段重新开放到 `PATCH /api/v1/skus/{id}`
2. 报关信息写权限仅商务部/管理员；产品部、财务部只能通过详情接口只读查看
3. 更新接口建议支持部分更新：未传字段保持原值，显式传 `null` 则清空对应字段
4. 更新成功后返回完整 SKU 明细，避免 4.5 / 4.6 再拼第二套取数逻辑
5. 不要在 4.2 引入新的海关规则依赖或外部校验服务

### 推荐 API 范围

- `PATCH /api/v1/skus/{id}/customs-info`
  - 入参：`customs_hscode`、`customs_supervision_condition`、`customs_declaration_elements`、`customs_refund_tax_rate`、`customs_info_ready`
  - 出参：`SKUDetail`

### 测试重点

- 商务部更新报关信息成功，返回值已同步变化
- 管理员可调用同一接口成功更新
- 产品部调用返回 403，错误消息为 `无权限执行此操作`
- 更新后产品部再次查看 SKU 详情时，报关字段可见但仅只读消费

### References

- `_bmad-output/planning-artifacts/epics.md`（Epic 4 / Story 4.2）
- `_bmad-output/planning-artifacts/prd-product-management.md`（SKU 报关信息维护）
- `_bmad-output/implementation-artifacts/4-1-sku-数据模型与-crud-api.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Dev Agent Record

### Debug Log

- 2026-04-18: create-story 完成，已基于 4.1 已落地 SKU 报关字段和 1.3 RBAC 规则补全 4.2 开发上下文
- 2026-04-18: 新增 `SKUCustomsInfoUpdate` schema、`PATCH /api/v1/skus/{id}/customs-info` 路由与专属 service 更新方法
- 2026-04-18: 补充商务部成功、管理员成功、产品部禁止但详情可读的 4.2 路由测试
- 2026-04-18: 后端验证通过，`bash scripts/backend-test.sh` 72/72 通过

### Completion Notes

- 已生成 4.2 故事上下文，供 `dev-story` 直接实施
- 已新增 `PATCH /api/v1/skus/{id}/customs-info`，专门承接报关字段更新，不污染 4.1 的通用 SKU 更新接口
- 已复用 4.1 已落地的报关字段模型与 SKU 明细返回结构，4.5 / 4.6 可直接复用
- 已确认商务部/管理员可写，产品部通过详情接口只读可见
- 验证完成：`PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m compileall erp-backend/app erp-backend/tests`
- 后端验证完成：`bash scripts/backend-test.sh` 72/72 通过

### File List

- `_bmad-output/implementation-artifacts/4-2-sku-报关信息维护.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `erp-backend/app/schemas/sku.py`
- `erp-backend/app/services/skus.py`
- `erp-backend/app/routers/skus.py`
- `erp-backend/tests/routers/test_skus.py`

### Change Log

- 2026-04-18: Story 创建并进入开发，状态更新为 in-progress
- 2026-04-18: Story 实现完成，后端 72 个测试全部通过，状态更新为 review
