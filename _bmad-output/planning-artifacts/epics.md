---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - _bmad-output/planning-artifacts/prd-product-management.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# cross-border-erp - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for cross-border-erp, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: 产品部可创建、编辑三级产品分类，维护层级关系（一级/二级/三级）
FR2: 产品部可调整同级分类的显示排序
FR3: 系统阻止删除已有 SPU 关联的分类
FR4: 分类编码在创建后不可修改
FR5: 产品部可创建、编辑 SPU，设置基础信息、采购信息及多条开票信息
FR6: 每个 SPU 唯一绑定一个供应商；在 SKU 被业务单据引用后，供应商不可变更
FR7: SPU 详情页聚合展示：下属 SKU 列表、关联证书（直属+通用+分类匹配）、关联 FAQ（SPU 级+全局）
FR8: 分类选择支持三级联动
FR9: 产品部可创建、编辑 SKU，选择 SPU 后自动继承分类、供应商、禁止经营国家
FR10: SKU 编码全局唯一，创建后不可修改
FR11: 产品部可管理 SKU 产品状态（上架/下架可售/下架不可售/临拓）
FR12: 商务部可维护 SKU 报关信息（HSCODE、监管条件、申报要素、退税税点）；产品部只读
FR13: SKU 详情页聚合展示：关联证书、产品资料、FAQ、销售价格
FR14: SKU 支持上传多张产品图片
FR15: 产品部可创建、编辑、删除产品资料，支持富文本内容和多文件附件
FR16: 资料归属支持三种模式：通用、指定 SKU（多选）、按分类
FR17: 资料可设定适用国家/地区范围
FR18: 产品部可创建、编辑、删除产品证书，记录有效期起止日期
FR19: 证书归属支持三种模式：通用、SPU 归属（多选）、按分类
FR20: 系统在证书有效期结束前 N 天（可配置，默认 30 天）标记"即将过期"
FR21: 系统将超过有效期的证书标记"已过期"，到期后保留历史记录
FR22: 产品部可创建、编辑、删除 FAQ，支持全局范围和 SPU 级别范围
FR23: FAQ 支持附件上传
FR24: 财务部可为 SKU 设置多条区域价格（国家/地区、销售价、列表价、币种）
FR25: 同一 SKU 同一国家/地区不允许重复设置价格
FR26: 价格变更需提交审批，审批通过前原有价格继续生效
FR27: 有审批权限的用户可审批或驳回价格变更申请
FR28: 管理员可下载系统提供的分类/SPU/SKU 标准导入模板
FR29: 管理员可通过 Excel 批量导入分类、SPU、SKU 数据
FR30: 系统对导入数据进行校验（格式、必填项、唯一性、关联有效性），并展示成功/失败明细
FR31: 校验失败后支持修正数据重新上传
FR32: 用户可按一级/二级/三级分类、供应商、产品状态、产品类型筛选 SPU/SKU 列表
FR33: 用户可通过关键词对 SPU/SKU/证书/资料进行模糊搜索
FR34: 证书列表支持按有效状态（有效/即将过期/已过期）筛选
FR35: 系统按角色（产品部/商务部/财务部/管理员）控制各子模块的读写权限
FR36: 系统按角色控制敏感数据可见性（采购价仅产品部/财务部/管理员可见；价格详情仅财务部/管理员可完整编辑）
FR37: 管理员可维护系统枚举值配置（单位、产品类型、证书类型、资料类型等）

### NonFunctional Requirements

NFR1: 常规页面加载（列表页、详情页）响应时间：P95 不超过 2 秒（20 名并发用户，正常网络环境），核心接口纳入 APM 监控
NFR2: SKU 详情页聚合查询（证书+资料+FAQ+价格关联）响应时间：P95 不超过 3 秒
NFR3: Excel 导入：单次导入 1000 条数据，处理时间不超过 30 秒，超过时提供进度反馈
NFR4: 系统支持 20 名内部用户并发在线正常使用；数据规模基线：SKU 总量 ≥ 10,000 条
NFR5: 所有用户操作须经身份认证，未登录不可访问任何页面
NFR6: 敏感字段（采购价、销售价）按角色权限控制可见性，系统不向无权限用户暴露敏感字段内容
NFR7: 数据传输使用 HTTPS 加密
NFR8: 关键数据变更（价格修改、产品下架）记录操作日志（操作人、时间、变更前后值）
NFR9: 工作时间（周一至周五 9:00-20:00）系统可用性不低于 99%（月度计划内工作时长内停机 ≤ 1.44 小时）
NFR10: 允许计划内维护停机（提前通知，非工作时间进行）
NFR11: 数据库每日自动备份，支持最近 7 天内的数据恢复
NFR12: 系统界面语言为中文，面向内部中文用户使用

### Additional Requirements

AR1: 使用 Vite + React + TypeScript（前端）/ FastAPI + Python 3.12+（后端）技术栈，项目初始化（骨架搭建）作为第一个实现 Story
AR2: 创建 Docker Compose 配置（Nginx + FastAPI + MySQL），支持本地开发及生产部署
AR3: 所有 SQLAlchemy Model 必须继承 BaseModel（含 id、created_at、updated_at、deleted_at 软删除字段）
AR4: 软删除策略：所有核心业务实体使用 deleted_at 软删除，禁止物理删除核心业务数据
AR5: JWT HTTP-only Cookie 认证实现（access token 30min + refresh token 7天）
AR6: RBAC 权限矩阵：代码定义 4 角色（产品部/商务部/财务部/管理员），通过 FastAPI Depends() 注入权限检查
AR7: 文件存储：阿里云 OSS（生产）/ MinIO（本地开发），后端生成预签名上传 URL，前端直传 OSS
AR8: 后端统一响应格式定义：PaginatedResponse（列表）、ErrorResponse（错误），统一 HTTP 状态码规范
AR9: APScheduler 内嵌 FastAPI 实现证书到期定时检测（每日调度）
AR10: 审计日志独立 audit_logs 表，Service 层调用统一 audit_service.log() 方法写入
AR11: 每个后端业务模块必须创建 model / schema / router / service / repository 五个文件
AR12: 前端所有 API 调用必须通过 TanStack Query v5（useQuery / useMutation），禁止组件内直接调用 axios
AR13: 前端 feature-based 模块结构：src/features/{module}/pages/ + components/ + hooks/ + types.ts
AR14: GitHub Actions CI/CD 配置（自动运行测试 + build Docker image）
AR15: 未来集成预留：CRM API（二期 /api/v1/external/ 前缀）、金蝶财务系统（三期）

### UX Design Requirements

UX-DR1: 实现 CacheTabs 组件（顶部页签导航 + KeepAlive 页面缓存），基于 AntD Tabs + react-activation，支持关闭页签、右键菜单（关闭其他/关闭所有），选中态红色底部边框
UX-DR2: 实现左侧垂直菜单导航（AntD Layout.Sider + Menu），深色背景 #001529，选中项 #C41D2E 红色高亮，支持折叠至 48px
UX-DR3: 实现 Ant Design ConfigProvider 主题定制：主色 #C41D2E，borderRadius: 4，中文字体栈，Table cellPaddingBlock: 12
UX-DR4: 实现 Tailwind CSS 配置（important: '#root'，扩展 primary 色值 #C41D2E）
UX-DR5: 实现 SectionTitle 组件（左侧 3px #C41D2E 竖线 + 红色 16px 标题文字，role="heading" aria-level="3"）
UX-DR6: 实现 FixedActionBar 组件（底部固定操作栏，高度 56px，白色背景，保存/取消按钮居中对齐，保存中 loading 态）
UX-DR7: 实现 FilterCard 组件（白色背景卡片，圆角 4px，1px #f0f0f0 边框，内边距 16px 16px 0 16px，作为列表页筛选区容器）
UX-DR8: 实现 InheritedField 组件（继承字段展示：灰色背景 #fafafa + "继承自 SPU" 灰色小标签，aria-readonly="true"）
UX-DR9: 实现 PaginationBar 组件（flex 布局：左侧"共 {total} 条"，右侧 AntD Pagination，高度 48px，上边距 12px）
UX-DR10: SKU 表单 SPU 继承逻辑前端实现：选择 SPU 后即时自动填充继承字段（分类/供应商/禁止经营国家），继承字段通过 InheritedField 展示为只读
UX-DR11: SKU 详情页聚合展示：顶部核心摘要 + Tab 分区（基础信息 / 产品证书 / 产品资料 / FAQ / 销售价格）
UX-DR12: 表单校验交互模式：提交时全量校验 + 自动滚动到第一个错误字段；编码类字段失焦触发实时唯一性校验；校验失败不清空已填内容
UX-DR13: 列表页三段式布局规范：FilterCard（筛选区）+ 操作栏 + Table（size="middle"） + PaginationBar，统一应用于所有子模块
UX-DR14: 远程搜索 Select 封装（支持 SPU/SKU 关键词远程搜索，下拉展示编码+名称）
UX-DR15: 价格审批状态标签：待审批（蓝 #1677ff）、已生效（绿 #52c41a）、已驳回（红 #ff4d4f）
UX-DR16: 证书状态颜色标签：有效（绿）、即将过期（橙）、已过期（红），标签同时显示颜色和文字，颜色体系统一应用
UX-DR17: 列表→表单→列表导航模式：点击新增/编辑新开页签，保存成功后自动关闭当前页签并刷新列表页签

### FR Coverage Map

| FR | Epic | 简述 |
|----|------|------|
| FR1 | Epic 2 | 三级分类 CRUD |
| FR2 | Epic 2 | 分类排序 |
| FR3 | Epic 2 | 分类删除保护 |
| FR4 | Epic 2 | 分类编码不可改 |
| FR5 | Epic 3 | SPU CRUD（基础/采购/开票） |
| FR6 | Epic 3 | SPU 供应商唯一绑定 |
| FR7 | Epic 3 | SPU 聚合展示 |
| FR8 | Epic 3 | 分类三级联动 |
| FR9 | Epic 4 | SKU CRUD + SPU 继承 |
| FR10 | Epic 4 | SKU 编码唯一不可改 |
| FR11 | Epic 4 | SKU 产品状态管理 |
| FR12 | Epic 4 | 报关信息字段级权限 |
| FR13 | Epic 4 | SKU 聚合详情页 |
| FR14 | Epic 4 | SKU 多图上传 |
| FR15 | Epic 6 | 资料 CRUD + 富文本 |
| FR16 | Epic 6 | 资料归属模型 |
| FR17 | Epic 6 | 资料适用国家 |
| FR18 | Epic 5 | 证书 CRUD |
| FR19 | Epic 5 | 证书归属模型 |
| FR20 | Epic 5 | 证书到期预警 |
| FR21 | Epic 5 | 过期证书历史保留 |
| FR22 | Epic 6 | FAQ CRUD |
| FR23 | Epic 6 | FAQ 附件上传 |
| FR24 | Epic 7 | 区域价格设置 |
| FR25 | Epic 7 | 价格唯一性校验 |
| FR26 | Epic 7 | 价格变更审批 |
| FR27 | Epic 7 | 审批/驳回操作 |
| FR28 | Epic 8 | 导入模板下载 |
| FR29 | Epic 8 | Excel 批量导入 |
| FR30 | Epic 8 | 导入校验反馈 |
| FR31 | Epic 8 | 错误修正重传 |
| FR32 | Epic 3+4 | SPU/SKU 多维度筛选 |
| FR33 | Epic 3+4+5+6 | 各模块关键词搜索 |
| FR34 | Epic 5 | 证书状态筛选 |
| FR35 | Epic 1 | RBAC 角色权限矩阵 |
| FR36 | Epic 1 | 敏感数据可见性控制 |
| FR37 | Epic 8 | 枚举值配置管理 |

## Epic List

### Epic 1: 系统初始化与用户认证
开发团队可以运行完整的本地开发环境；所有内部用户可通过账号登录系统，并根据角色（产品部/商务部/财务部/管理员）获得相应的权限与界面访问控制，系统整体应用骨架（导航、布局、主题）完成搭建。
**FRs covered:** FR35, FR36
**ARs:** AR1-AR14
**UX-DRs:** UX-DR1, UX-DR2, UX-DR3, UX-DR4
**NFRs:** NFR5, NFR7

### Epic 2: 产品分类管理
产品部可以完整维护三级产品分类体系（增/改/排序/删除保护），为所有 SPU 和 SKU 提供统一的分类数据基础。
**FRs covered:** FR1, FR2, FR3, FR4

### Epic 3: SPU 管理
产品部可以完整管理 SPU（标准产品单元），包括基础信息、采购信息、多条开票信息，并通过 SPU 聚合详情页查看关联 SKU 列表、证书和 FAQ。
**FRs covered:** FR5, FR6, FR7, FR8, FR32(SPU), FR33(SPU)
**UX-DRs:** UX-DR13

### Epic 4: SKU 完整管理
产品部可以完整创建和维护 SKU（含 SPU 继承自动填充、产品图片上传、状态管理）；商务部可维护 SKU 报关信息；所有角色可通过 SKU 聚合详情页（证书/资料/FAQ/价格 Tab）获取完整产品档案视图。
**FRs covered:** FR9, FR10, FR11, FR12, FR13, FR14, FR32(SKU), FR33(SKU)
**UX-DRs:** UX-DR5-14, UX-DR17
**NFRs:** NFR1, NFR2

### Epic 5: 产品证书管理
产品部可以管理全部合规证书（CE/FDA/ISO等），通过灵活归属模型（通用/SPU/分类）自动关联至 SKU 详情页；系统主动预警即将到期证书，防止发运时调取过期证书。
**FRs covered:** FR18, FR19, FR20, FR21, FR34, FR33(证书)
**UX-DRs:** UX-DR16

### Epic 6: 产品资料库与 FAQ 管理
产品部可以管理产品文档资料（含富文本内容和文件附件）和常见问答，通过归属模型（通用/指定SKU/按分类）自动聚合到 SKU 详情页，任何角色无需跨系统查找产品资料。
**FRs covered:** FR15, FR16, FR17, FR22, FR23, FR33(资料)

### Epic 7: 销售价格管理与审批
财务部可以为每个 SKU 设置多区域价格（含全球及分国定价）并提交审批；具有审批权限的用户可审批或驳回；审批通过后的最新价格在 SKU 详情页只读展示，确保价格变更有据可查。
**FRs covered:** FR24, FR25, FR26, FR27
**UX-DRs:** UX-DR15
**NFRs:** NFR8

### Epic 8: 数据导入与系统配置
管理员可通过 Excel 批量导入历史分类/SPU/SKU 数据（含完整校验反馈和错误修正机制），完成系统上线数据迁移；并可维护系统全局枚举值配置（单位、产品类型、证书类型等）。
**FRs covered:** FR28, FR29, FR30, FR31, FR37
**NFRs:** NFR3, NFR4

## Epic 1: 系统初始化与用户认证

开发团队可以运行完整的本地开发环境；所有内部用户可通过账号登录系统，并根据角色（产品部/商务部/财务部/管理员）获得相应的权限与界面访问控制，系统整体应用骨架（导航、布局、主题）完成搭建。

### Story 1.1: 项目骨架与开发环境搭建

As a 开发人员,
I want 完整的前后端项目骨架和本地开发环境,
So that 团队可以立即开始业务功能开发，且所有基础设施规范（目录结构、数据库基类、统一响应格式、异常处理）从第一天起保持一致。

**Acceptance Criteria:**

**Given** 开发人员克隆代码仓库
**When** 执行 `docker-compose up`
**Then** Nginx（80端口）、FastAPI（8000端口）、MySQL（3306端口）、MinIO（9000端口）全部正常启动
**And** 前端开发服务器（5173端口）可访问空白页面

**Given** 后端项目已初始化
**When** 检查 `erp-backend/app/` 目录结构
**Then** 包含 core/（config.py, exceptions.py）、db/（base.py, session.py）、models/、schemas/（common.py）、routers/、services/、repositories/ 完整目录
**And** `BaseModel` Mixin 包含 id、created_at、updated_at、deleted_at 字段
**And** `PaginatedResponse` 和 `ErrorResponse` 通用 Schema 已定义
**And** `BusinessError` 异常类和全局 exception handler 已实现

**Given** 前端项目已初始化
**When** 检查 `erp-frontend/src/` 目录结构
**Then** 包含 api/、components/、features/、hooks/、stores/、types/、utils/ 完整目录
**And** Axios client 已配置（withCredentials: true）
**And** TanStack Query Provider 已在 App 层注册

**Given** Alembic 迁移配置已就绪
**When** 执行 `alembic upgrade head`
**Then** 数据库 migration 成功执行，数据库表结构创建完成

### Story 1.2: 用户认证系统（登录/登出/Token刷新）

As a 系统用户,
I want 通过账号密码安全登录系统,
So that 我的操作经过身份验证，未登录不可访问任何业务页面。

**Acceptance Criteria:**

**Given** users 表已创建（含 username, password_hash, role, is_active 字段）
**When** 用户提交正确的用户名和密码到 `POST /api/v1/auth/login`
**Then** 返回 200，设置 HTTP-only Cookie（access_token 有效期 30 分钟，refresh_token 有效期 7 天）
**And** 响应体包含用户基本信息（id, username, role）

**Given** 用户未登录（无 Cookie）
**When** 访问任意 `/api/v1/*` 业务接口（除 login）
**Then** 返回 401 Unauthorized

**Given** access_token 已过期但 refresh_token 有效
**When** 调用 `POST /api/v1/auth/refresh`
**Then** 返回新的 access_token Cookie，用户无感刷新

**Given** 用户已登录
**When** 调用 `POST /api/v1/auth/logout`
**Then** 清除 access_token 和 refresh_token Cookie

**Given** 用户密码存储
**When** 查看数据库 password_hash 字段
**Then** 使用 bcrypt 哈希，非明文存储

### Story 1.3: RBAC 权限矩阵与字段级权限

As a 管理员,
I want 系统根据角色（产品部/商务部/财务部/管理员）自动控制各子模块的读写权限和敏感数据可见性,
So that 每个角色只能访问和操作其职责范围内的数据，敏感信息不会泄露给无权限用户。

**Acceptance Criteria:**

**Given** permissions.py 定义了 4 角色权限矩阵
**When** 产品部用户访问分类管理 API
**Then** 允许读写操作
**And** 商务部用户访问同一 API 时仅允许只读

**Given** RBAC 依赖注入已实现
**When** 任意 Router 使用 `Depends(require_role("product_dept", "admin"))`
**Then** 只有产品部和管理员角色可以访问该端点
**And** 其他角色返回 403 Forbidden，错误消息为中文

**Given** 字段级权限通过不同 Pydantic Response Schema 实现
**When** 商务部用户查看 SPU 详情
**Then** 响应中不包含采购价（purchase_price）字段
**And** 产品部和财务部用户可以看到采购价字段

**Given** 管理员已创建初始用户数据（种子数据）
**When** 系统启动
**Then** 至少存在 4 个测试账号，分别对应产品部、商务部、财务部、管理员角色

### Story 1.4: 前端应用骨架与导航系统

As a 系统用户,
I want 通过左侧菜单导航到各子模块，并通过顶部页签在已打开页面间快速切换（切换后保留筛选条件和滚动位置）,
So that 我可以高效地在多个模块间来回工作，不丢失页面状态。

**Acceptance Criteria:**

**Given** 用户已登录
**When** 进入系统
**Then** 左侧显示深色背景（#001529）垂直菜单，包含产品管理（分类/SPU/SKU/证书/资料/FAQ）、价格管理、数据导入等菜单项
**And** 选中菜单项以红色（#C41D2E）高亮
**And** 侧边栏支持折叠至 48px

**Given** 用户点击左侧菜单项
**When** 该页面尚未打开
**Then** 顶部页签栏新增一个页签，并切换到对应页面
**And** 页签选中态显示红色底部边框

**Given** 用户已打开多个页签
**When** 在页签 A 设置了筛选条件，然后切换到页签 B，再切回页签 A
**Then** 页签 A 的筛选条件、滚动位置完好保留（KeepAlive 缓存）

**Given** 用户右键点击页签
**When** 选择"关闭其他"
**Then** 除当前页签外的所有页签关闭，对应缓存清除

**Given** AntD ConfigProvider 主题配置
**When** 查看系统 UI
**Then** 主色为 #C41D2E，圆角 4px，使用中文字体栈
**And** Tailwind CSS 配置 important: '#root'，不与 AntD 样式冲突

**Given** 用户未登录
**When** 访问任意业务页面 URL
**Then** 自动重定向到登录页面

### Story 1.5: 通用 UI 组件库

As a 开发人员,
I want 一套可复用的自定义 UI 组件（SectionTitle、FixedActionBar、FilterCard、InheritedField、PaginationBar）,
So that 后续所有子模块的列表页和表单页可以保持统一的视觉规范和交互模式。

**Acceptance Criteria:**

**Given** SectionTitle 组件
**When** 在表单页使用
**Then** 显示左侧 3px #C41D2E 红色竖线 + 红色 16px 标题文字
**And** 具有 role="heading" aria-level="3" 无障碍属性

**Given** FixedActionBar 组件
**When** 在表单页底部使用
**Then** 固定在页面底部，高度 56px，白色背景，顶部 1px 分隔线 + 阴影
**And** 保存/取消按钮居中对齐
**And** 保存按钮支持 loading 态

**Given** FilterCard 组件
**When** 在列表页筛选区使用
**Then** 白色背景卡片，圆角 4px，1px #f0f0f0 边框，内边距 16px 16px 0 16px

**Given** InheritedField 组件
**When** 展示从 SPU 继承的只读字段
**Then** 灰色背景 #fafafa + "继承自 SPU" 灰色小标签
**And** 具有 aria-readonly="true" 属性

**Given** PaginationBar 组件
**When** 在列表页表格下方使用
**Then** 左侧显示"共 {total} 条"，右侧显示 AntD Pagination 控件
**And** 高度 48px，上边距 12px

### Story 1.6: 审计日志、定时任务与 CI/CD

As a 管理员,
I want 系统自动记录关键数据变更的操作日志，支持定时任务调度，并具备自动化测试和构建流水线,
So that 关键操作有据可查、定时任务（如证书到期检测）有运行基础、代码质量有保障。

**Acceptance Criteria:**

**Given** audit_logs 表已创建（含 user_id, action, entity_type, entity_id, changes_before, changes_after, created_at）
**When** Service 层调用 `audit_service.log(user, action, entity_type, entity_id, before, after)`
**Then** 一条审计日志记录写入 audit_logs 表
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

## Epic 2: 产品分类管理

产品部可以完整维护三级产品分类体系（增/改/排序/删除保护），为所有 SPU 和 SKU 提供统一的分类数据基础。

### Story 2.1: 分类数据模型与三级分类 CRUD API

As a 产品部用户,
I want 创建和编辑三级产品分类（一级/二级/三级），并维护层级关系,
So that 产品分类体系建立后，SPU 和 SKU 可以正确关联到分类。

**Acceptance Criteria:**

**Given** product_categories 表已创建（含 code, name, level, parent_id, sort_order 字段）
**When** 产品部用户调用 `POST /api/v1/products/categories` 创建一级分类
**Then** 分类创建成功，level=1，parent_id=null
**And** 分类编码全局唯一

**Given** 一级分类已存在
**When** 产品部用户创建二级分类并指定 parent_id 为该一级分类
**Then** 二级分类创建成功，level=2
**And** 三级分类同理，parent_id 指向二级分类

**Given** 分类已创建
**When** 尝试修改分类编码
**Then** 返回 400 错误："分类编码创建后不可修改"（FR4）

**Given** 分类下已有 SPU 关联
**When** 尝试删除该分类
**Then** 返回 400 错误："该分类下已有产品关联，无法删除"（FR3）

**Given** 产品部用户调整同级分类的排序
**When** 调用排序 API 传入新的 sort_order
**Then** 同级分类按新排序展示（FR2）

**Given** 商务部用户尝试创建分类
**When** 调用 `POST /api/v1/products/categories`
**Then** 返回 403 Forbidden（商务部对分类管理仅有只读权限）

### Story 2.2: 分类管理前端页面

As a 产品部用户,
I want 在分类管理页面通过树形结构直观地浏览、新增、编辑和排序分类,
So that 我可以高效地维护产品分类体系。

**Acceptance Criteria:**

**Given** 用户进入分类管理页面
**When** 页面加载完成
**Then** 左侧显示分类树形结构，支持展开/折叠各级节点
**And** 右侧显示选中分类的详情/编辑区域

**Given** 用户在分类树上点击"新增子分类"
**When** 填写分类编码和名称并保存
**Then** 新分类出现在树的对应位置
**And** 保存成功后顶部 message 提示"保存成功"

**Given** 用户拖拽同级分类调整排序
**When** 拖拽完成释放
**Then** 排序更新并即时反映在分类树中

**Given** 用户尝试删除一个已有 SPU 关联的分类
**When** 点击删除按钮
**Then** 弹出确认对话框，确认后显示错误提示"该分类下已有产品关联，无法删除"

**Given** 商务部/财务部用户进入分类管理页面
**When** 页面加载完成
**Then** 可以浏览分类树，但新增/编辑/删除/排序按钮不显示或禁用

## Epic 3: SPU 管理

产品部可以完整管理 SPU（标准产品单元），包括基础信息、采购信息、多条开票信息，并通过 SPU 聚合详情页查看关联 SKU 列表、证书和 FAQ。

### Story 3.1: SPU 数据模型与 CRUD API

As a 产品部用户,
I want 创建和编辑 SPU（含基础信息、采购信息、多条开票信息），每个 SPU 唯一绑定一个供应商,
So that 产品型号数据完整录入系统，作为 SKU 的父级实体和数据继承源。

**Acceptance Criteria:**

**Given** spus 表及 spu_invoice_infos 子表已创建
**When** 产品部用户调用 `POST /api/v1/spus` 创建 SPU
**Then** SPU 创建成功，含基础信息（编码、名称、分类、质保期、单位、禁止经营国家）、采购信息（供应商、厂家型号、采购价、采购质保期）
**And** SPU 编码全局唯一

**Given** SPU 已创建
**When** 尝试修改 SPU 编码
**Then** 返回 400 错误："SPU编码创建后不可修改"

**Given** SPU 下已有 SKU 被业务单据引用
**When** 尝试修改该 SPU 的供应商
**Then** 返回 400 错误："该SPU下已有SKU被业务引用，供应商不可变更"（FR6）

**Given** SPU 创建时关联开票信息
**When** 提交不包含任何开票信息的 SPU
**Then** 返回 400 错误："开票信息至少需要一条"

**Given** SPU 创建时选择分类
**When** 调用分类级联 API `GET /api/v1/products/categories/tree`
**Then** 返回完整的三级分类树，支持前端级联选择（FR8）

**Given** 产品部用户查询 SPU 列表
**When** 传入筛选参数（一级/二级/三级分类、供应商、关键词）
**Then** 返回匹配的分页 SPU 列表（FR32, FR33）

### Story 3.2: SPU 列表页与筛选

As a 产品部用户,
I want 在 SPU 列表页通过分类、供应商、关键词筛选快速找到目标 SPU,
So that 我可以高效定位和管理产品型号。

**Acceptance Criteria:**

**Given** 用户进入 SPU 列表页
**When** 页面加载完成
**Then** 顶部为 FilterCard 筛选区（分类级联、供应商下拉、关键词输入框、查询/重置按钮）
**And** 下方为操作栏（左侧"新增"按钮）
**And** 表格展示 SPU编码、SPU名称、三级分类、供应商、SKU数量、创建时间
**And** 底部 PaginationBar 左侧显示"共 X 条"，右侧分页控件（UX-DR13 列表页三段式布局）

**Given** 用户输入关键词"超声"
**When** 点击"查询"
**Then** 表格刷新，仅显示 SPU编码或名称包含"超声"的记录
**And** PaginationBar 总数更新

**Given** 用户点击"重置"
**When** 筛选条件全部清空
**Then** 表格恢复显示全量数据

**Given** 用户点击表格行"查看"操作
**When** 进入 SPU 详情页
**Then** 以新页签打开（UX-DR17）

### Story 3.3: SPU 新增/编辑表单页

As a 产品部用户,
I want 通过分区平铺的表单完整录入 SPU 的基础信息、采购信息和开票信息,
So that SPU 数据一次性录入完整，无需多次保存。

**Acceptance Criteria:**

**Given** 用户点击"新增 SPU"
**When** 表单页打开（新页签）
**Then** 表单分三个分区（SectionTitle）：基础信息、采购信息、开票信息
**And** 分类字段为三级联动 Cascader
**And** 供应商字段为远程搜索 Select（UX-DR14）

**Given** 用户填写开票信息
**When** 点击"添加开票信息"
**Then** 开票信息子表新增一行（可编辑表格：开票品名、开票单位、开票型号、公司主体）
**And** 支持多行新增和删除

**Given** 用户填写完成后点击底部"保存"按钮（FixedActionBar）
**When** 所有必填字段已填写
**Then** 保存成功，顶部 message 提示"保存成功"
**And** 自动关闭当前页签，SPU 列表页签自动刷新

**Given** 用户编辑已有 SPU
**When** SPU编码字段
**Then** 显示为只读（disabled + tooltip "创建后不可修改"）

### Story 3.4: SPU 详情页（聚合展示）

As a 产品部用户,
I want 在 SPU 详情页一览该型号的完整信息，包括下属 SKU 列表、关联证书和 FAQ,
So that 我无需跳转多个页面即可了解一个产品型号的全貌。

**Acceptance Criteria:**

**Given** 用户进入 SPU 详情页
**When** 页面加载完成
**Then** 顶部展示 SPU 全部字段信息（基础信息、采购信息、开票信息）
**And** 采购价（CNY）字段：产品部和财务部可见，商务部不可见（FR36）

**Given** SPU 详情页底部
**When** 展示关联数据
**Then** 显示该 SPU 下的 SKU 列表（SKU编码、SKU中文名称，可点击跳转）（FR7）
**And** 显示关联证书列表（直接归属该 SPU 的证书 + 通用证书 + 该 SPU 分类匹配的证书）（FR7）
**And** 显示关联 FAQ 列表（该 SPU 的 FAQ + 全局 FAQ）（FR7）

**Given** SKU 列表中某 SKU
**When** 用户点击该 SKU 编码
**Then** 以新页签打开 SKU 详情页

## Epic 4: SKU 完整管理

产品部可以完整创建和维护 SKU（含 SPU 继承自动填充、产品图片上传、状态管理）；商务部可维护 SKU 报关信息；所有角色可通过 SKU 聚合详情页（证书/资料/FAQ/价格 Tab）获取完整产品档案视图。

### Story 4.1: SKU 数据模型与 CRUD API

As a 产品部用户,
I want 创建和编辑 SKU，选择 SPU 后自动继承分类、供应商、禁止经营国家,
So that 每个规格变体的数据完整且与 SPU 保持一致。

**Acceptance Criteria:**

**Given** skus 表及 sku_package_details 子表已创建（含基础信息、产品属性、特殊属性、包装信息、报关信息全部字段）
**When** 产品部用户调用 `POST /api/v1/skus` 创建 SKU 并指定 spu_id
**Then** SKU 创建成功，自动继承 SPU 的一级/二级/三级分类、供应商、禁止经营国家（FR9）
**And** SKU 编码全局唯一（FR10）
**And** 产品状态默认"上架"

**Given** SKU 已创建
**When** 尝试修改 SKU 编码
**Then** 返回 400 错误："SKU编码创建后不可修改"（FR10）

**Given** SKU 的客户质保期字段
**When** 未显式设置时
**Then** 继承 SPU 的客户质保期值
**And** 显式设置时以 SKU 级别值为准（可覆盖）

**Given** 产品部用户查询 SKU 列表
**When** 传入筛选参数（分类、供应商、产品状态、产品类型、关键词）
**Then** 返回匹配的分页 SKU 列表（FR32, FR33）
**And** 关键词支持 SKU编码/中文名称/英文名称模糊匹配

**Given** SKU 创建时包含包装明细
**When** 提交包装明细子表数据（净重/毛重/长/宽/高/体积）
**Then** 包装明细记录与 SKU 关联保存

### Story 4.2: SKU 报关信息维护（商务部专属）

As a 商务部用户,
I want 为 SKU 维护报关信息（HSCODE、监管条件、申报要素、退税税点）,
So that 发运/报关模块可以正确获取报关数据。

**Acceptance Criteria:**

**Given** 商务部用户调用 `PATCH /api/v1/skus/{id}/customs-info`
**When** 提交报关信息（HSCODE、监管条件、申报要素、退税税点、是否已维护报关信息）
**Then** 报关信息更新成功（FR12）

**Given** 产品部用户调用同一 API
**When** 尝试修改报关信息
**Then** 返回 403 Forbidden："报关信息仅商务部可编辑"（FR12）

**Given** 产品部用户查看 SKU 详情
**When** 获取 SKU 完整信息
**Then** 报关信息字段可见但标记为只读（FR12）

### Story 4.3: SKU 产品图片上传

As a 产品部用户,
I want 为 SKU 上传多张产品图片,
So that 产品形象有图片记录，下游模块和客户沟通时可引用。

**Acceptance Criteria:**

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

### Story 4.4: SKU 列表页与筛选

As a 系统用户,
I want 在 SKU 列表页通过分类、供应商、产品状态、产品类型、关键词多维度筛选快速定位目标 SKU,
So that 在 8000+ SKU 中高效找到需要的产品。

**Acceptance Criteria:**

**Given** 用户进入 SKU 列表页
**When** 页面加载完成
**Then** 顶部 FilterCard 筛选区：一级/二级/三级分类（级联）、供应商（远程搜索）、产品状态（下拉）、产品类型（下拉）、关键词输入框、查询/重置按钮
**And** 操作栏左侧："新增"按钮（产品部/管理员可见）
**And** 表格列：SKU编码、SKU中文名称、产品型号、SPU编码、供应商、产品状态（颜色标签）、创建时间、操作（编辑|查看）
**And** 底部 PaginationBar

**Given** 用户选择产品状态"下架不可售"
**When** 点击"查询"
**Then** 仅显示产品状态为"下架不可售"的 SKU

**Given** 用户在 SKU 列表设置了筛选条件并翻到第 3 页
**When** 切换到其他页签再切回
**Then** 筛选条件和分页位置完好保留（KeepAlive）

### Story 4.5: SKU 新增/编辑表单页

As a 产品部用户,
I want 通过平铺分区的长表单一次性完成 SKU 全部信息录入，选择 SPU 后继承字段自动填充,
So that 录入高效、数据继承正确、不遗漏字段。

**Acceptance Criteria:**

**Given** 用户点击"新增 SKU"
**When** 表单页打开
**Then** 表单分六个分区（SectionTitle）：基础信息、产品属性、特殊属性、包装信息+包装明细、报关信息、产品图片
**And** 字段按 3 列 grid 布局

**Given** 用户在基础信息分区选择 SPU（远程搜索 Select）
**When** 选择完成
**Then** 继承字段（分类、供应商、禁止经营国家）即时自动填充
**And** 继承字段以 InheritedField 组件展示（灰色背景 + "继承自 SPU" 标签）（UX-DR8, UX-DR10）
**And** 客户质保期显示为"继承自 SPU，可覆盖"，可编辑

**Given** 用户输入 SKU 编码后失焦
**When** 编码已存在
**Then** 字段下方即时显示红色提示"SKU编码已存在，请更换"（UX-DR12）

**Given** 报关信息分区（产品部视角）
**When** 表单加载
**Then** 全部字段灰底只读，顶部提示"报关信息由商务部维护"

**Given** 报关信息分区（商务部视角）
**When** 表单加载
**Then** HSCODE、监管条件、申报要素、退税税点、是否已维护均可编辑

**Given** 用户点击底部"保存"（FixedActionBar）
**When** 校验失败（如必填字段未填）
**Then** 页面自动滚动到第一个错误字段，红色边框 + 字段下方错误提示（UX-DR12）
**And** 已填内容不被清空

**Given** 保存成功
**When** 操作完成
**Then** 顶部 message 提示"保存成功"
**And** 自动关闭当前页签，SKU 列表页签自动刷新（UX-DR17）

### Story 4.6: SKU 详情页（聚合展示）

As a 系统用户（所有角色）,
I want 在 SKU 详情页一页查看全部产品信息，包括关联的证书、资料、FAQ、销售价格,
So that 任何角色打开同一个 SKU 就能看到与自己相关的全部信息，不用跨系统查找。

**Acceptance Criteria:**

**Given** 用户进入 SKU 详情页
**When** 页面加载完成
**Then** 顶部摘要区展示：SKU编码、SKU中文名称、产品状态（颜色标签）、SPU编码、供应商
**And** 下方以 Tab 分区展示关联数据（UX-DR11）

**Given** Tab "基础信息"
**When** 选中
**Then** 展示 SKU 全部字段（基础信息、产品属性、特殊属性、包装信息、包装明细、报关信息、产品图片）
**And** 继承字段标注"继承自 SPU"
**And** 敏感字段按角色控制可见性（采购价仅产品部/财务部/管理员可见）

**Given** Tab "产品证书"
**When** 选中
**Then** 展示关联证书列表：该 SKU 所属 SPU 的证书 + 通用证书 + 分类匹配证书（FR13）
**And** 证书状态标签：有效（绿）/即将过期（橙）/已过期（红）

**Given** Tab "产品资料"
**When** 选中
**Then** 展示关联资料列表：通用资料 + 指定该 SKU 的资料 + 该 SKU 所属分类的资料（FR13）

**Given** Tab "FAQ"
**When** 选中
**Then** 展示关联 FAQ 列表：该 SKU 所属 SPU 的 FAQ + 全局 FAQ（FR13）

**Given** Tab "销售价格"
**When** 选中
**Then** 展示最新已审批的区域价格表（国家/地区、销售价、列表价、币种），只读（FR13）

**Given** SKU 聚合查询性能
**When** 加载详情页
**Then** 全部关联数据（证书+资料+FAQ+价格）响应时间 P95 不超过 3 秒（NFR2）

### Story 4.7: SKU 产品状态管理

As a 产品部用户,
I want 管理 SKU 的产品状态（上架/下架可售/下架不可售/临拓）,
So that 可以控制产品的销售可用性。

**Acceptance Criteria:**

**Given** 产品部用户编辑 SKU 产品状态
**When** 将状态从"上架"改为"下架不可售"
**Then** 状态变更成功
**And** 审计日志记录该变更（操作人、时间、变更前后值）（NFR8）

**Given** SKU 状态为"下架可售"
**When** 下游模块查询可售 SKU
**Then** 该 SKU 仍在可售范围内（不主动推荐，但已有客户仍可下单）

**Given** SKU 状态为"下架不可售"
**When** 下游模块查询可售 SKU
**Then** 该 SKU 不在可售范围内（新订单不可选择）

**Given** SKU 列表页
**When** 查看产品状态列
**Then** 各状态以不同颜色标签展示（上架-绿、下架可售-橙、下架不可售-红、临拓-蓝）

## Epic 5: 产品证书管理

产品部可以管理全部合规证书（CE/FDA/ISO等），通过灵活归属模型（通用/SPU/分类）自动关联至 SKU 详情页；系统主动预警即将到期证书，防止发运时调取过期证书。

### Story 5.1: 证书数据模型与 CRUD API

As a 产品部用户,
I want 创建和编辑产品证书（含有效期、归属模型），系统自动标记证书有效状态,
So that 合规证书数据完整录入系统，到期风险可被系统自动识别。

**Acceptance Criteria:**

**Given** certificates 表已创建（含名称、编号、类型、发证机构、有效期起止、归属类型、证书文件等字段）
**When** 产品部用户调用 `POST /api/v1/certificates` 创建证书
**Then** 证书创建成功，证书编号全局唯一

**Given** 证书有效期设置
**When** 起始日期晚于或等于结束日期
**Then** 返回 400 错误："有效期起始日期必须早于结束日期"

**Given** 归属类型为"SPU归属"
**When** 创建证书并指定适用 SPU（多选）
**Then** 该证书关联到指定的 SPU（FR19）
**And** 这些 SPU 下的所有 SKU 详情页自动展示该证书

**Given** 归属类型为"按分类"
**When** 创建证书并指定适用分类
**Then** 该证书关联到该分类下所有 SPU/SKU（FR19）

**Given** 归属类型为"通用"
**When** 创建证书
**Then** 该证书在所有 SKU 详情页展示（FR19）

**Given** 证书列表查询
**When** 传入筛选参数（证书类型、归属类型、有效状态、关键词）
**Then** 返回匹配的分页证书列表（FR34, FR33）

### Story 5.2: 证书到期预警与状态自动标记

As a 产品部用户,
I want 系统自动标记证书的有效期状态（有效/即将过期/已过期），并在证书到期前主动预警,
So that 我可以及时发现需要续期的证书，避免发运时调取过期证书。

**Acceptance Criteria:**

**Given** 证书有效期结束日期距今超过 30 天
**When** 查询证书状态
**Then** 标记为"有效"

**Given** 证书有效期结束日期距今 ≤ 30 天（可配置）且未过期
**When** 查询证书状态
**Then** 标记为"即将过期"（FR20）

**Given** 证书有效期结束日期已过
**When** 查询证书状态
**Then** 标记为"已过期"（FR21）
**And** 证书记录保留，不自动删除

**Given** APScheduler 每日定时任务执行
**When** 扫描所有证书有效期
**Then** 更新所有证书的状态标记
**And** 即将过期和已过期的证书状态正确反映在列表和详情页

### Story 5.3: 证书管理前端页面

As a 产品部用户,
I want 在证书管理页面查看、筛选、新增和编辑证书，通过颜色标签一眼识别证书状态,
So that 我可以高效管理合规证书并及时处理到期风险。

**Acceptance Criteria:**

**Given** 用户进入证书列表页
**When** 页面加载完成
**Then** 筛选区：证书类型、归属类型、有效状态（有效/即将过期/已过期）、关键词
**And** 表格列：证书名称、证书编号、证书类型、归属范围摘要、有效期、状态（颜色标签）
**And** 状态标签：有效（绿 #52c41a）、即将过期（橙 #faad14）、已过期（红 #ff4d4f），同时显示文字（UX-DR16）

**Given** 用户筛选"即将过期"
**When** 点击查询
**Then** 仅显示即将过期的证书，便于集中处理续期

**Given** 用户点击"新增"进入证书表单页
**When** 选择归属类型
**Then** Radio 按钮组切换（通用/SPU归属/按分类），切换时清空已选关联对象
**And** SPU 归属时显示 SPU 多选搜索框
**And** 按分类时显示分类级联选择器

**Given** 用户上传证书文件
**When** 选择文件
**Then** 支持 PDF/JPG/PNG 格式，显示文件名和大小

## Epic 6: 产品资料库与 FAQ 管理

产品部可以管理产品文档资料（含富文本内容和文件附件）和常见问答，通过归属模型（通用/指定SKU/按分类）自动聚合到 SKU 详情页，任何角色无需跨系统查找产品资料。

### Story 6.1: 产品资料数据模型与 CRUD API

As a 产品部用户,
I want 创建和编辑产品资料（含富文本内容、多文件附件、灵活归属模型）,
So that 产品相关文档集中管理，不再分散在各部门文件夹中。

**Acceptance Criteria:**

**Given** product_documents 表已创建（含名称、类型、内容（富文本）、归属类型、适用SKU、适用分类、国家/地区等字段）
**When** 产品部用户调用 `POST /api/v1/products/documents` 创建资料
**Then** 资料创建成功

**Given** 资料提交时
**When** 资料内容和资料文件均为空
**Then** 返回 400 错误："资料内容和资料文件至少填写一项"

**Given** 归属类型为"指定SKU"
**When** 未选择任何 SKU
**Then** 返回 400 错误："归属类型为'指定SKU'时，SKU 选择必填"（FR16）

**Given** 归属类型为"按分类"
**When** 未选择分类
**Then** 返回 400 错误："归属类型为'按分类'时，分类选择必填"（FR16）

**Given** 资料设定了适用国家/地区
**When** SKU 详情页展示资料
**Then** 仅展示匹配国家/地区的资料（FR17）

**Given** 资料支持多文件附件
**When** 上传多个文件
**Then** 所有文件通过 OSS 预签名上传，URL 关联到资料记录

### Story 6.2: FAQ 数据模型与 CRUD API

As a 产品部用户,
I want 创建和编辑 FAQ（支持全局范围和 SPU 级别），含附件上传,
So that 产品常见问题集中管理，客户沟通时可快速查阅。

**Acceptance Criteria:**

**Given** faqs 表已创建（含 SPU 关联（可选）、问题类型、问题、答案、附件字段）
**When** 产品部用户调用 `POST /api/v1/faqs` 创建 FAQ 并指定 SPU
**Then** FAQ 创建成功，关联到指定 SPU

**Given** FAQ 创建时未指定 SPU
**When** 保存
**Then** FAQ 作为全局 FAQ，适用所有产品（FR22）

**Given** 问题字段
**When** 输入超过 200 字
**Then** 返回校验错误："问题最大 200 字"

**Given** FAQ 支持附件
**When** 上传附件文件
**Then** 文件通过 OSS 预签名上传并关联（FR23）

### Story 6.3: 资料与 FAQ 管理前端页面

As a 产品部用户,
I want 在资料管理和 FAQ 管理页面高效维护产品文档和常见问题,
So that 我可以方便地集中管理所有产品相关资料和问答。

**Acceptance Criteria:**

**Given** 用户进入产品资料列表页
**When** 页面加载完成
**Then** 筛选区：资料类型、归属类型、关键词
**And** 表格列：资料名称、资料类型、归属类型、归属范围摘要、创建时间
**And** 操作：新增、查看、编辑、删除

**Given** 用户新增资料
**When** 表单页打开
**Then** 分两个分区：基础资料（名称、类型、富文本内容、文件上传）、归属信息（归属类型、关联对象、国家/地区）
**And** 归属类型切换时动态显示对应关联字段

**Given** 用户进入 FAQ 列表页
**When** 页面加载完成
**Then** 筛选区：SPU（远程搜索）、问题类型、关键词
**And** 表格列：问题、SPU（空则显示"全局"）、问题类型、创建时间
**And** 操作：新增、编辑、删除

**Given** 用户新增 FAQ
**When** 表单页打开
**Then** 简单表单：SPU（可选，远程搜索）、问题类型、问题、答案、附件上传

## Epic 7: 销售价格管理与审批

财务部可以为每个 SKU 设置多区域价格（含全球及分国定价）并提交审批；具有审批权限的用户可审批或驳回；审批通过后的最新价格在 SKU 详情页只读展示，确保价格变更有据可查。

### Story 7.1: 价格数据模型与 CRUD API

As a 财务部用户,
I want 为每个 SKU 设置多条区域价格（国家/地区、销售价、列表价、币种）,
So that 不同区域的客户获得对应的报价。

**Acceptance Criteria:**

**Given** prices 表及 price_regions 子表已创建
**When** 财务部用户调用 `POST /api/v1/prices` 创建价格记录并指定 SKU
**Then** 创建成功，系统自动带出 SKU 关联信息（名称、分类、SPU、采购价、供应商等）

**Given** 区域价格子表
**When** 同一 SKU 同一国家/地区提交重复记录
**Then** 返回 400 错误："同一 SKU 同一国家/地区不可重复设置价格"（FR25）

**Given** 产品部用户尝试创建价格
**When** 调用价格创建 API
**Then** 返回 403 Forbidden（销售价格管理仅财务部和管理员可编辑）

### Story 7.2: 价格变更审批流

As a 财务部用户,
I want 提交价格变更后需经审批，审批通过前原有价格继续生效,
So that 价格变更有控制、有记录，不会未经审批就影响业务报价。

**Acceptance Criteria:**

**Given** 财务部用户提交价格变更
**When** 调用 `POST /api/v1/prices/{id}/submit`
**Then** 价格记录状态变为"待审批"（FR26）
**And** 审计日志记录提交操作（NFR8）

**Given** 价格处于"待审批"状态
**When** SKU 详情页查看价格
**Then** 展示的仍是上一次已审批通过的价格（FR26）

**Given** 具有 `product:price:approve` 权限的用户
**When** 调用 `POST /api/v1/prices/{id}/approve`
**Then** 价格状态变为"已生效"，新价格在 SKU 详情页展示（FR27）
**And** 审计日志记录审批操作（包含审批人、时间、价格变更前后值）

**Given** 审批人驳回价格变更
**When** 调用 `POST /api/v1/prices/{id}/reject` 并填写驳回原因
**Then** 价格状态变为"已驳回"（FR27）
**And** 财务人员可编辑后重新提交

### Story 7.3: 价格管理前端页面

As a 财务部用户,
I want 在价格管理页面高效设置和管理各 SKU 的区域价格，清晰了解审批进度,
So that 定价工作可以流畅地完成。

**Acceptance Criteria:**

**Given** 用户进入价格列表页
**When** 页面加载完成
**Then** 筛选区：一级分类、供应商、关键词（SKU编码/名称）
**And** 表格列：SKU编码、SKU中文名称、供应商、采购价(CNY)、销售价摘要、审批状态、更新时间
**And** 审批状态标签：待审批（蓝 #1677ff）、已生效（绿 #52c41a）、已驳回（红 #ff4d4f）（UX-DR15）

**Given** 用户新增价格
**When** 选择 SKU 后
**Then** 系统自动带出 SKU 信息（只读），下方为区域价格可编辑子表
**And** 每行一个区域（国家/地区、销售价、列表价、币种、备注）
**And** 支持新增行/删除行

**Given** 价格状态为"已驳回"
**When** 财务人员查看该记录
**Then** 可以编辑后重新提交

## Epic 8: 数据导入与系统配置

管理员可通过 Excel 批量导入历史分类/SPU/SKU 数据（含完整校验反馈和错误修正机制），完成系统上线数据迁移；并可维护系统全局枚举值配置（单位、产品类型、证书类型等）。

### Story 8.1: Excel 导入模板与批量导入 API

As a 管理员,
I want 下载标准导入模板并通过 Excel 批量导入分类、SPU、SKU 历史数据,
So that 系统上线时可以快速完成历史数据迁移。

**Acceptance Criteria:**

**Given** 管理员调用 `GET /api/v1/import/templates/{type}` （type = categories/spus/skus）
**When** 下载导入模板
**Then** 返回标准 Excel 模板文件，含字段名和填写说明（FR28）

**Given** 管理员上传填写好的 Excel 文件
**When** 调用 `POST /api/v1/import/{type}`
**Then** 系统执行校验：格式、必填项、唯一性（编码不重复）、关联有效性（分类/供应商必须已存在）（FR30）
**And** 返回校验结果：成功条数 / 失败条数 / 失败原因明细（逐行）

**Given** 校验结果中有失败记录
**When** 管理员修正数据后重新上传
**Then** 系统重新校验，支持反复修正直到通过（FR31）

**Given** 校验全部通过后确认导入
**When** 调用确认导入 API
**Then** 数据写入数据库，返回最终导入成功条数

**Given** 单次导入 1000 条数据
**When** 执行导入
**Then** 处理时间不超过 30 秒（NFR3）
**And** 超过时提供进度反馈

### Story 8.2: 数据导入前端页面

As a 管理员,
I want 在导入页面选择导入类型、下载模板、上传文件、查看校验结果并确认导入,
So that 数据迁移过程可视化、可控。

**Acceptance Criteria:**

**Given** 用户进入数据导入页面
**When** 页面加载完成
**Then** 显示三个导入类型选项卡（分类/SPU/SKU）
**And** 每个类型提供"下载模板"按钮和"上传 Excel"按钮

**Given** 用户上传 Excel 文件
**When** 校验完成
**Then** 页面展示校验结果：成功 X 条 / 失败 Y 条
**And** 失败记录以表格展示（行号、字段名、错误原因）
**And** 全部成功时显示"确认导入"按钮

**Given** 导入耗时较长
**When** 处理进行中
**Then** 显示进度条或百分比反馈

**Given** 非管理员/非产品部用户
**When** 访问数据导入页面
**Then** 页面不可见或提示无权限

### Story 8.3: 枚举值配置管理

As a 管理员,
I want 维护系统全局枚举值（单位、产品类型、证书类型、资料类型等）,
So that 各子模块的下拉选项可以灵活调整，不需要修改代码。

**Acceptance Criteria:**

**Given** enums 表已创建（含 enum_group, enum_key, enum_value, sort_order 字段）
**When** 管理员调用 `GET /api/v1/enums?group=unit`
**Then** 返回"单位"枚举组的所有可选值（个、件、双、台等）

**Given** 管理员新增枚举值
**When** 调用 `POST /api/v1/enums`
**Then** 新枚举值创建成功，立即可在对应下拉选项中使用

**Given** 管理员编辑或调整枚举排序
**When** 修改枚举值或排序
**Then** 所有引用该枚举的下拉选项立即反映变化

**Given** 枚举配置前端页面
**When** 管理员进入配置页
**Then** 左侧为枚举组列表（单位、产品类型、产品状态、包装类型、电参数、证书类型、FAQ问题类型、资料类型、币种）
**And** 右侧为选中组的枚举值列表，支持新增、编辑、删除、排序
**And** 仅管理员角色可访问（FR37）
