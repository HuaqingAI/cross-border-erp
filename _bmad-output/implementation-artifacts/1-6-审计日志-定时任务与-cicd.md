# Story 1.6: 审计日志、定时任务与 CI/CD

**Status:** done
**Story Key:** 1-6-审计日志-定时任务与-cicd
**Epic:** 1 - 系统初始化与用户认证
**Date:** 2026-04-16

---

## User Story

As a 管理员,
I want 系统自动记录关键数据变更的操作日志，支持定时任务调度，并具备自动化测试和构建流水线,
So that 关键操作有据可查、定时任务（如证书到期检测）有运行基础、代码质量有保障。

---

## Acceptance Criteria

**Given** `audit_logs` 表已创建（含 `user_id`, `action`, `entity_type`, `entity_id`, `changes_before`, `changes_after`, `created_at`）  
**When** Service 层调用 `audit_service.log(user, action, entity_type, entity_id, before, after)`  
**Then** 一条审计日志记录写入 `audit_logs` 表  
**And** 记录包含操作人、操作时间、变更前后值

**Given** APScheduler 已在 FastAPI lifespan 事件中初始化  
**When** FastAPI 应用启动  
**Then** 调度器正常运行，支持注册定时任务（cron/interval）  
**And** 应用关闭时调度器正常停止

**Given** GitHub Actions CI 配置已就绪  
**When** 推送代码到主分支  
**Then** 自动执行后端 pytest 测试  
**And** 自动执行前端 Vitest 测试  
**And** 自动构建 Docker image

---

## Scope

### In Scope

- 审计日志数据模型与迁移（`audit_logs` 表）
- 审计日志服务实现与统一调用入口（`app/core/audit.py`）
- FastAPI 启停生命周期内调度器初始化与关闭（`app/core/scheduler.py` + `app/main.py`）
- 至少一个可运行的定时任务注册示例（证书到期检测占位任务可接受）
- CI 工作流验证与必要修正（确保 backend-test / frontend-test / docker-build 稳定）
- 后端相关单元测试/集成测试补充

### Out of Scope

- 证书到期业务规则的完整实现（可在 Epic 5 Story 5.2 完整落地）
- 前端新的业务页面开发
- 非关键操作的全量审计接入（本 Story 先覆盖关键写操作入口）

---

## 依赖与前置条件

| Story | 状态 | 说明 |
|------|------|------|
| 1-1 | done | 项目骨架、异常体系、DB 基础设施 |
| 1-2 | done | 认证体系与用户上下文 |
| 1-3 | done | RBAC 与权限中间件 |
| 1-4 | done | 前端应用骨架与导航 |
| 1-5 | done | 通用 UI 组件库 |

---

## 实施任务建议

- [x] Task 1: 审计日志落库能力
  - [x] 新增 `audit_logs` SQLAlchemy Model 与 Alembic migration
  - [x] 实现 `app/core/audit.py` 的写库逻辑（替换占位 `pass`）
  - [x] 补充最小可用测试（写入成功、字段完整性）

- [x] Task 2: 调度器生命周期集成
  - [x] 在 `app/core/scheduler.py` 实现 APScheduler 初始化/关闭
  - [x] 在 `app/main.py` 的 lifespan 中接入 `init_scheduler`/`shutdown_scheduler`
  - [x] 注册一个演示任务并验证应用启停行为

- [x] Task 3: CI 稳定性校验
  - [x] 检查 `.github/workflows/ci.yml` 与当前代码结构一致
  - [x] 本地执行后端/前端测试与构建验证
  - [x] 修复阻塞 CI 的问题并记录变更

---

## Dev Notes

- 现状占位代码：
  - `erp-backend/app/core/audit.py` 目前为占位实现
  - `erp-backend/app/core/scheduler.py` 目前为占位实现
  - `erp-backend/app/main.py` lifespan 注释已预留 1.6 接入点
- CI 文件已存在：`.github/workflows/ci.yml`
- 开发语言与文档语言遵循项目约定：中文

### 推荐修改路径

- `erp-backend/alembic/versions/*`（新增迁移）
- `erp-backend/app/models/*`（新增/扩展审计日志模型）
- `erp-backend/app/core/audit.py`
- `erp-backend/app/core/scheduler.py`
- `erp-backend/app/main.py`
- `erp-backend/tests/*`（补充测试）
- `.github/workflows/ci.yml`（必要时）

### References

- `_bmad-output/planning-artifacts/epics.md`（Story 1.6）
- `_bmad-output/planning-artifacts/architecture.md`（AR9, AR10, AR14）
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Dev Agent Record

### Debug Log

- 2026-04-16: 审计服务按 `audit_service.log(user, action, entity_type, entity_id, before, after)` 落地，并支持可选复用外部 `AsyncSession`
- 2026-04-16: APScheduler 已接入 FastAPI lifespan，注册 `certificate-expiry-placeholder` 演示任务
- 2026-04-16: 修复 CI 后端测试环境变量不匹配问题，新增 `TEST_DB_URL`
- 2026-04-16: 根据 code review 反馈，将审计日志改为强制复用调用方事务，避免业务回滚后残留假审计记录
- 2026-04-16: 根据 code review 反馈，将生产 API worker 数调整为 1，避免嵌入式 APScheduler 重复执行任务
- 2026-04-16: 根据二次 code review 反馈，将开发态 API 挂载拆分到 `docker-compose.dev.yml`，避免生产 compose 继承源码挂载

### Completion Notes

- 已新增 `audit_logs` 模型、Alembic 迁移、审计服务实现与 2 个后端测试文件
- 已完成调度器初始化/关闭、示例任务注册，以及 `app/main.py` 生命周期接入
- 本地前端验证完成：`npm run test -- --run` 30/30 通过，`npm run build` 成功
- 后端验证已在 Python 3.12 Docker 容器内完成：`pytest tests -q` 35/35 通过
- 当前仓库本地 `.venv` 仍绑定 Python 3.9；后端日常本地开发建议后续切换到 Python 3.12 以与 CI 保持一致
- 已修复 2 个 P1 review findings：审计日志事务一致性、生产环境调度器重复执行
- 修复后重新验证：`bash scripts/backend-test.sh` 36/36 通过，`docker compose -f docker-compose.yml -f docker-compose.prod.yml config` 校验通过
- 已修复生产 compose 继承开发态源码挂载的问题，开发态覆盖已迁移到 `docker-compose.dev.yml`
- 最终复审通过，Story 1.6 已完成并关闭

### File List

- `erp-backend/app/models/audit_log.py`
- `erp-backend/app/models/__init__.py`
- `erp-backend/alembic/versions/0002_create_audit_logs_table.py`
- `erp-backend/app/core/audit.py`
- `erp-backend/app/core/scheduler.py`
- `erp-backend/app/main.py`
- `erp-backend/tests/core/test_audit.py`
- `erp-backend/tests/core/test_scheduler.py`
- `.github/workflows/ci.yml`
- `_bmad-output/implementation-artifacts/1-6-审计日志-定时任务与-cicd.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-16: Story 1.6 开发中，已完成审计日志落库、调度器生命周期接入、CI 环境变量修复与前端本地验证
- 2026-04-16: 在 Python 3.12 Docker 容器中完成后端 pytest 验证，Story 状态更新为 review
- 2026-04-16: 已按 code review 修复 2 个 P1 问题，并完成后端回归验证，等待再次 review
- 2026-04-16: 已按二次 code review 修复生产 compose 继承开发挂载的问题，等待再次 review
- 2026-04-16: 最终 code review 通过，Story 状态更新为 done
