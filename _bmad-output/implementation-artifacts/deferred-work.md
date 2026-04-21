# Deferred Work

## Deferred from: code review of 1-1-项目骨架与开发环境搭建 (2026-04-14)

- 开发环境硬编码凭证（password/minioadmin）是预期的开发默认值 — 生产由 docker-compose.prod.yml 覆盖
- get_db 对所有请求（含只读）无条件 commit — 已知的 session-per-request 设计权衡，可后续优化
- docker compose build 在 CI 无缓存且丢弃构建产物 — CI 优化，不影响正确性，后续可添加 --cache-from 和 registry push
- 401 拦截器为 TODO 占位 — Story 1.2 范围，届时实现登录页跳转逻辑
- document.getElementById('root')! 非空断言 — 标准 Vite 模板写法，可接受
- TokenResponse 缺少 refresh_token 字段 — Story 1.2 占位文件，届时补全
- lifespan 为空占位，DB 启动探测未实现 — Story 1.6 待填充调度器和启动检查

## Deferred from: code review of 1-4-前端应用骨架与导航系统 (2026-04-15)

- 前端权限仅菜单可见性，不是安全门控 — 后端 RBAC 已在 Story 1.3 实现，API 层有保护，无需前端路由守卫
- `closeOtherTabs` 传入不存在 key 时 `activeTabKey` 可能悬空 — 极低概率，无现实触发路径，后续可加防御判断
- `usePermission` 在 `getMe` 异步完成前返回全 false — Story 1.2 架构，若需优化可在 ProtectedRoute 中等待 user 加载后再渲染子树
- `defaultOpenKeys` 折叠/展开后不持久 — AntD 已知行为；如需持久，可将 openKeys 受控并存入 uiStore
- 通配符重定向丢失原始目标 URL — 如需实现 post-login redirect，ProtectedRoute 应保存 `location` 到 state
- `queryClient` 模块级单例测试间可能串缓存 — 如影响测试稳定性，可在测试 setup 中调用 `queryClient.clear()`
- `ProtectedRoute` 不检测会话期间 token 过期 — Story 1.2 范畴；可通过 Axios 401 拦截器触发登出解决

## Deferred from: code review of 1-2-用户认证系统 (2026-04-14)

- Token 无吊销机制，logout/refresh 后旧 token 仍有效至过期 — 需 Redis/DB 黑名单基础设施，超出 Story 1.2 范围
- access/refresh token 共用同一 SECRET_KEY — 安全增强，建议后续 Story 分离为两个独立密钥
- seed.py 将明文密码打印到 stdout — 仅限 dev 工具，当前可接受，生产不应执行
- 每次请求均查询 DB 获取用户，无缓存层 — 性能优化，高并发场景可引入短期缓存
- updated_at 无自动更新触发器 — BaseModel 遗留问题，需在 BaseModel 层添加 onupdate=func.now()
- SECRET_KEY 默认值弱校验 — 依赖 Story 1.1 启动验证器，确认覆盖场景足够
- delete_cookie 未指定 path/domain，子路径反代场景可能无法清除 Cookie — 当前部署无此问题
- 登录接口无速率限制/账号锁定机制 — 需网关或应用层限流，超出本 Story 范围
- is_active server_default=sa.text("1") 对 PostgreSQL 不兼容 — 当前仅支持 MySQL，切换 DB 时需修改迁移

## Deferred from: Epic 5 sequencing decision after Story 5.1 (2026-04-20)

- Story 5.2「证书到期预警与状态自动标记」暂缓实施，保持 backlog，不进入当前开发流程
- 暂缓原因：Story 5.1 已提供证书 `validity_status` 动态计算与按有效状态筛选能力，当前证书主流程已可用；5.2 属于主动治理/预警增强项，不阻塞证书管理基础能力上线
- 当前替代基础：证书列表与详情查询已可实时返回 `有效 / 即将过期 / 已过期`，用户可手动筛选待续期证书
- 恢复触发条件：证书前端管理页面（Story 5.3）上线后，或业务明确提出“系统需主动扫描并提醒即将过期证书”需求时，再恢复 Story 5.2
- 后续推进建议：Epic 5 后续优先显式指定 Story 5.3，而不是自动拾取 Story 5.2
