# Deferred Work

## Deferred from: code review of 1-1-项目骨架与开发环境搭建 (2026-04-14)

- 开发环境硬编码凭证（password/minioadmin）是预期的开发默认值 — 生产由 docker-compose.prod.yml 覆盖
- get_db 对所有请求（含只读）无条件 commit — 已知的 session-per-request 设计权衡，可后续优化
- docker compose build 在 CI 无缓存且丢弃构建产物 — CI 优化，不影响正确性，后续可添加 --cache-from 和 registry push
- 401 拦截器为 TODO 占位 — Story 1.2 范围，届时实现登录页跳转逻辑
- document.getElementById('root')! 非空断言 — 标准 Vite 模板写法，可接受
- TokenResponse 缺少 refresh_token 字段 — Story 1.2 占位文件，届时补全
- lifespan 为空占位，DB 启动探测未实现 — Story 1.6 待填充调度器和启动检查

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
