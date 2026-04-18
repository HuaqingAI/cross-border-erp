# Cross-Border ERP

跨境ERP系统 -- 项目由 BMAD Method 驱动。

## Project Structure

- `_bmad/` -- BMAD 配置与 skills
- `_bmad-output/` -- BMAD 产出（规划/实现/测试产物）
- `docs/` -- 项目文档
- `.claude/skills/` -- Claude Code skills
- `.agents/skills/` -- Codex skills（兼容映射到 `.claude/skills`）

## Conventions

- 沟通语言：中文
- 文档输出语言：中文

## Frontend Conventions

- 列表页默认使用紧凑内容区，页面自身不要重复叠加外边距；优先复用布局层统一留白。
- 列表页默认不额外展示页面标题，优先保留筛选区、操作栏、表格和分页作为主内容。
- 新增/编辑页默认使用三列表单布局；中屏降为两列，小屏降为一列。
- 新增/编辑页的一级信息块默认拆分为独立卡片，不要把多个分区包在一个连续大白块里；优先复用通用卡片容器。
- 新增/编辑页卡片之间默认垂直间距为 `16px`；卡片内边距默认 `16px`。
- 卡片内三列表单默认使用紧凑节奏：`columnGap = 24px`、`rowGap = 16px`；普通 `Form.Item` 不应再额外叠加更大的底部留白。
- 新增/编辑页底部操作栏应固定在右侧工作区底部，不遮挡左侧菜单，不额外保留左右和底部空白。
- 左侧菜单与顶部页签在内容滚动时应保持固定，滚动仅发生在右侧内容区。
- 对复杂字段，Story 或 Dev Notes 必须明确：组件类型、前端默认值、提交值类型、空值策略。
- 复杂表单建议统一实现 `toFormValues()` 与 `toPayload()`，避免字段映射散落在页面逻辑中。
- 可选数组字段不得假设一定有值；提交前必须兜底为 `[]`。
- 子表字段优先使用 `Form.List`，不要使用容易因重绘导致值丢失的临时拼装方式。
- 没有真实远程搜索接口时，不要伪装成远程搜索 `Select`；应明确降级为普通输入或普通选择。
- 对被 `KeepAlive` 缓存且依赖路由参数的页面，不要让页面组件自行依赖 `useParams()` 决定核心业务模式。
- `new / edit / detail` 页面应由路由层显式传入 `mode` 与 `id`，页面组件仅根据 props 执行逻辑。
- 列表页与详情/编辑页并存时，更新成功后不能只刷新列表缓存；必须同步更新或失效详情缓存，避免再次进入编辑页时回显旧数据。
- 详细字段契约与缓存一致性规则优先参考 `_bmad-output/implementation-artifacts/form-field-contract-template.md`。
