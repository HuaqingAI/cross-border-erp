# Sprint Change Proposal - 2026-04-19

## Issue Summary

Epic 4 原规划中的 `Story 4.7: SKU 产品状态管理` 预期包含独立的状态管理流程、审计日志以及对下游“可售 SKU”范围的系统化管控。

结合近期 `4.1 / 4.4 / 4.5` 的实际落地和业务反馈，团队确认：

- 当前业务上已经有 `product_status` 字段用于标识 SKU 状态
- 列表筛选、列表标签展示、表单编辑已足够满足日常使用
- 不同部门之间的状态执行更多依赖线下协同与约定
- 继续为“下游可售范围强管控 + 独立审计流程”单开一个 Story，投入产出不高

因此，建议正式取消独立的 `Story 4.7`，并将范围收缩为：

- 保留 SKU 状态字段
- 保留列表展示与筛选
- 保留表单编辑
- 不再承诺独立的状态管理流程、审计日志和下游强管控

## Impact Analysis

### Epic Impact

- Epic 4 仍然保留 `FR11`，但口径从“独立的 SKU 产品状态管理能力”收缩为“状态字段标识与基础展示/编辑”
- Epic 4 的故事数量由 `4.1-4.7` 收缩为 `4.1-4.6`

### Story Impact

- `4.7` 从 backlog 中移除，不再进入开发排期
- 已完成故事 `4.1 / 4.4 / 4.5` 中关于“后续由 4.7 承接”的引用需要同步清理

### Artifact Impact

- `epics.md`：移除独立 `Story 4.7`，同步 `FR11` 口径
- `prd-product-management.md`：同步 `FR11` 与 SKU 状态业务规则说明
- `prd-product-management-validation-report.md`：为 `FR11` 增加范围收缩说明
- `sprint-status.yaml`：移除 `4-7-sku-产品状态管理`
- `4.1 / 4.4 / 4.5` implementation artifacts：移除对 `Story 4.7` 的前向引用

## Recommended Approach

推荐采用 **Direct Adjustment**：

- 不新增替代 Story
- 直接在现有规划和工件中同步“取消独立 4.7、保留状态字段”的口径
- 后续若业务真的需要更强状态治理，再以新的独立 Story 重新立项

### Rationale

- 当前系统已经具备状态字段、筛选、展示和编辑能力
- 取消 4.7 不会影响已完成功能的可用性
- 可以减少后续对下游模块强约束的误预期

## Detailed Change Proposals

### Epics / Stories

- `FR11` 调整为：SKU 提供产品状态字段用于业务标识、列表展示与基础编辑
- 删除独立 `Story 4.7`
- 在 Epic 4 中补充范围调整说明，明确状态字段保留、独立流程取消

### PRD

- 将 `FR11` 从“产品部可管理 SKU 产品状态”收缩为“SKU 提供产品状态字段用于业务标识”
- 在 SKU 业务规则中补充：当前版本不对下游模块实施系统强管控

### Validation Report

- 为 `FR11` 增加说明：范围已调整为字段级标识与展示/编辑，不再单列独立 Story

### Implementation Artifacts

- 将 `4.1 / 4.4 / 4.5` 中“→ Story 4.7”改为“当前版本不再拆独立 Story 4.7”

## Implementation Handoff

### Scope Classification

- **Moderate**

这是一次已批准的排期与文档范围调整，不涉及代码回滚，但需要同步多个规划与实施工件。

### Handoff Targets

- Product / Planning artifacts owner：更新 `epics.md`、`prd-product-management.md`
- Delivery tracking owner：更新 `sprint-status.yaml`
- Implementation artifact owner：更新 `4.1 / 4.4 / 4.5` 相关引用

### Success Criteria

- 文档中不再存在“待做 4.7”的默认假设
- `FR11` 的口径与当前已落地系统能力一致
- 后续团队成员阅读文档时，可明确理解这是“主动取消的 Story”，而不是“漏做”
