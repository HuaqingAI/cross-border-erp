# Cross-Border ERP 阿里云 ECS 部署说明

这份文档按“产品也能照着操作”的方式来写。

当前仓库推荐的上线方式是：

- 服务器：阿里云 ECS
- 部署方式：Docker Compose 单机部署
- 前端：React 打包后放进容器
- 后端：FastAPI
- 数据库：MySQL 8
- 文件存储：MinIO

如果你的服务器上已经有别的项目在跑，请优先使用“同机共存模式”：

- 不抢占现有项目常用的 `80` / `443` / `9000` / `9001`
- 先把 ERP 跑在独立端口上
- 确认没问题后，再考虑是否接入现有 Nginx 或新域名

注意：

- 当前版本的文件上传依赖 MinIO 直传，所以正式部署时需要把 MinIO 一起启动。
- 当前版本还不是“阿里云 OSS 直连版”，如果以后要切 OSS，需要单独再改一轮存储配置。

## 一、你要先准备什么

你至少要准备好这些东西：

- 一台已经开通的阿里云 ECS
- 服务器可以用 SSH 登录
- 服务器里已经安装好 Docker 和 Docker Compose
- 这个项目代码已经上传到服务器

如果你还没有把代码放上去，最简单的方式是：

1. 在本地把代码推到 Git 仓库
2. SSH 登录服务器
3. 在服务器上执行 `git clone 你的仓库地址`

## 二、服务器安全组怎么开

你至少需要放行这些端口：

- `22`：SSH 登录服务器
- `80`：ERP 系统访问入口
- `9000`：MinIO 文件上传和图片访问

可选端口：

- `9001`：MinIO 管理后台，只在你确实要登录 MinIO 管理页面时开放

如果你是“同机共存模式”，则不要照搬上面的端口，而是放行你自己准备使用的新端口。

示例：

- `18080`：ERP 访问入口
- `19000`：MinIO 文件上传和图片访问
- `19001`：MinIO 管理后台

如果这是正式外网环境，建议：

- `9001` 不要长期开公网
- 先只给自己办公网络开放，确认没问题后再扩大范围

## 三、把配置文件准备好

进入项目根目录后，先执行：

```bash
cp .env.prod.example .env.prod
```

然后打开 `.env.prod`，重点改这几个值：

- `APP_ORIGIN`
  作用：ERP 前端访问地址
  示例：`http://你的服务器公网IP`
- `MINIO_PUBLIC_ENDPOINT`
  作用：浏览器上传图片时访问 MinIO 的地址
  示例：`http://你的服务器公网IP:9000`
- `NGINX_HOST_PORT`
  作用：ERP 在宿主机上占用的端口
- `MINIO_API_HOST_PORT`
  作用：MinIO 对外文件访问端口
- `MINIO_CONSOLE_HOST_PORT`
  作用：MinIO 管理后台端口
- `MYSQL_ROOT_PASSWORD`
  作用：MySQL 管理员密码
- `MINIO_ROOT_PASSWORD`
  作用：MinIO 管理密码
- `SECRET_KEY`
  作用：登录态 JWT 密钥
- `INIT_ADMIN_USERNAME`
  作用：首次自动创建的管理员账号
- `INIT_ADMIN_PASSWORD`
  作用：首次自动创建的管理员密码

如果你现在只是先跑通，不急着上 HTTPS，就先保持：

```env
COOKIE_SECURE=false
```

如果你和现有项目共用一台服务器，我建议你先直接这样改：

```env
NGINX_HOST_PORT=18080
MINIO_API_HOST_PORT=19000
MINIO_CONSOLE_HOST_PORT=19001
APP_ORIGIN=http://你的服务器公网IP:18080
MINIO_PUBLIC_ENDPOINT=http://你的服务器公网IP:19000
COOKIE_SECURE=false
```

## 四、开始部署

在项目根目录执行：

```bash
bash scripts/prod-up.sh
```

这个脚本会自动做 3 件事：

1. 构建并启动生产容器
2. 执行数据库迁移
3. 自动创建管理员账号

如果中途失败，先执行：

```bash
bash scripts/prod-status.sh
```

## 五、部署成功后怎么验证

部署完成后，你按这个顺序检查：

1. 检查后端健康状态

```bash
curl http://你的服务器IP:你的ERP端口/health
```

如果成功，应该看到：

```json
{"status":"ok"}
```

2. 用浏览器打开：

```text
http://你的服务器IP:你的ERP端口
```

如果成功，你应该能看到系统登录页或系统首页。

3. 用 `.env.prod` 里设置的管理员账号登录。

4. 如果系统里要上传图片，再额外确认：

```text
http://你的服务器IP:你的MinIO端口
```

这个地址至少要能被浏览器访问到，否则图片上传会失败。

## 六、常用命令

查看运行状态：

```bash
bash scripts/prod-status.sh
```

停止服务：

```bash
bash scripts/prod-down.sh
```

看实时日志：

```bash
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

## 七、你最可能遇到的 5 个问题

### 1. 首页打不开

优先检查：

- ECS 安全组是否放行了你在 `.env.prod` 里配置的 ERP 端口
- `bash scripts/prod-status.sh` 里 `nginx`、`frontend`、`api` 是否都在运行

### 2. `/health` 打不开

优先检查：

- `api` 容器是否启动成功
- 数据库密码是否配错
- 数据库迁移是否执行成功

### 3. 能登录，但上传图片失败

优先检查：

- MinIO 对外端口是否放行
- `.env.prod` 里的 `MINIO_PUBLIC_ENDPOINT` 是否写成了真实公网地址
- `minio` 容器是否在运行

如果上面都没问题，但浏览器里仍然提示跨域错误，请继续检查：

- MinIO 控制台里是否已经允许你的 ERP 地址跨域访问
- 你的浏览器打开 ERP 的地址，是否和 `.env.prod` 里的 `APP_ORIGIN` 一致

### 4. 首次登录失败

优先检查：

- `.env.prod` 里的 `INIT_ADMIN_USERNAME` / `INIT_ADMIN_PASSWORD` 是否填写
- 首次部署时 `prod-up.sh` 是否执行到了“初始化管理员账号”这一步

### 5. 改了 `.env.prod` 但没有生效

执行一次完整重启：

```bash
bash scripts/prod-down.sh
bash scripts/prod-up.sh
```

## 八、上线前我建议你知道的事

这套部署已经适合你先在自己的阿里云服务器上跑起来做演示、联调和内部试用。

但如果你后面要给外部团队长期使用，我建议再做这几件事：

- 给 ERP 域名配 HTTPS
- 把 `COOKIE_SECURE` 改成 `true`
- 给 MySQL 做备份
- 限制 `9001` 端口访问范围
- 后续把 MinIO 方案升级成阿里云 OSS 正式方案

## 九、同机共存时的最稳做法

如果你现在这台服务器已经有别的项目，请按这个思路操作：

1. 不要动现有项目的 Nginx 配置。
2. 不要使用 `80` / `443` / `9000` / `9001` 这些常用端口。
3. 先在 ERP 自己的独立端口上启动，比如：
   - ERP：`18080`
   - MinIO API：`19000`
   - MinIO 控制台：`19001`
4. 先确认 ERP 自己能跑起来，再决定要不要接入域名。
