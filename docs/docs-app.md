# 文档 (Docs) 应用

> Tokimo 内置的 Block Editor 文档应用，对标 Notion / 飞书文档，替代 Joplin / Notion 等外部工具。
> 核心：结构化存储（Slate JSON，非 HTML）— 支持全文搜索、多端渲染、AI 提取。

---

## 一、概述

文档应用是 Tokimo 应用系统中类型为 `document` 的应用，提供所见即所得的 Block Editor 编辑体验。

**核心设计决策：**

- **Slate JSON 存储**：内容以 Slate 节点树（JSON）存入 PostgreSQL JSONB 列，而非 HTML / Markdown。结构化数据天然支持语义搜索、多设备渲染和 AI 内容分析。
- **编辑器引擎**：[Plate v52](https://platejs.org/)（基于 Slate，MIT 协议，16K+ stars），ESM-only 架构。
- **应用归属**：每个文档属于一个 `App`，通过 `appId` 关联，支持多工作区隔离。
- **文件夹分组**：支持嵌套文件夹，前端构建树结构（后端返回平铺列表）。

---

## 二、数据模型

### Doc 表（`docs`）

来源：`prisma/schema.prisma`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `UUID` (PK) | 文档 ID |
| `app_id` | `UUID` (FK → App) | 所属应用 |
| `folder_id` | `UUID?` (FK → DocFolder) | 所属文件夹，NULL 表示根目录 |
| `title` | `String` | 标题，默认 "无标题" |
| `content` | `Json?` (JSONB) | Slate JSON 节点树 |
| `icon` | `String?` | 文档 emoji 图标 |
| `cover_image` | `String?` | 封面图片 URL |
| `is_favorite` | `Boolean` | 收藏标记 |
| `is_pinned` | `Boolean` | 置顶标记 |
| `is_archived` | `Boolean` | 归档标记（列表查询默认排除） |
| `word_count` | `Int` | 字数统计 |
| `created_at` | `Timestamptz` | 创建时间 |
| `updated_at` | `Timestamptz` | 更新时间 |

**索引：**
- `(app_id, updated_at DESC)` — 列表按更新排序
- `(app_id, folder_id)` — 按文件夹过滤

**级联规则：**
- App 删除 → 文档 Cascade 删除
- DocFolder 删除 → 文档 `folder_id` 置 NULL

### DocFolder 表（`doc_folders`）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `UUID` (PK) | 文件夹 ID |
| `app_id` | `UUID` (FK → App) | 所属应用 |
| `parent_id` | `UUID?` (FK → self) | 父文件夹，NULL 表示顶层 |
| `name` | `String` | 文件夹名称 |
| `icon` | `String?` | emoji 图标 |
| `sort_order` | `Int` | 排序序号（同级内递增） |
| `created_at` | `Timestamptz` | 创建时间 |
| `updated_at` | `Timestamptz` | 更新时间 |

**索引：** `(app_id, parent_id)`

**级联规则：**
- App 删除 → 文件夹 Cascade 删除
- 父文件夹删除 → 子文件夹 `parent_id` 置 NULL

### 内容存储格式

`content` 列存储 Slate 节点数组（Value），示例：

```json
[
  { "type": "h1", "children": [{ "text": "标题" }] },
  { "type": "p", "children": [{ "text": "正文内容，", "bold": true }, { "text": "普通文字" }] },
  { "type": "blockquote", "children": [{ "text": "引用文本" }] }
]
```

### 字数统计算法

`DocService::count_words()` — 递归遍历 Slate 节点提取 `text` 字段：

- **CJK 字符**（中 / 日 / 韩）：每个字符计 1 字
- **拉丁文本**：按空白符分词，每个 token 计 1 字
- 混合文本自动识别，无需语言检测

---

## 三、后端分层

遵循 `Router → Handler → Service → Repo → Entity` 架构。

### 分层职责

```
router/docs.rs       路由注册（build_doc_routes）
    ↓
handlers/doc.rs      参数提取、UUID 解析、调用 Repo/Service、JSON 响应
    ↓
services/doc_service.rs   业务逻辑（当前：字数统计）
    ↓
db/repos/doc_repo.rs      所有数据库操作（DocRepo + DocFolderRepo）
    ↓
db/entities/docs.rs, doc_folders.rs   Sea-ORM entity（自动生成）
    ↓
db/models/doc.rs     DTO 输出类型（DocOutput / DocListItem / DocFolderOutput）
```

### DTO 类型

**DocListItem**（列表视图，不含 content）：
- 使用 `DerivePartialModel` — 查询时仅 SELECT 必要列
- 派生 `ts_rs::TS` + `#[ts(export)]`，自动生成 TypeScript 类型

**DocOutput**（完整详情，含 content）：
- 使用 `From<docs::Model>` 方式 B 转换 — Uuid→String / DateTime→RFC3339
- 派生 `ts_rs::TS` + `#[ts(export)]`

**DocFolderOutput**（文件夹）：
- 使用 `DerivePartialModel`
- 派生 `ts_rs::TS` + `#[ts(export)]`

---

## 四、前端架构

### Editor 组件（`DocEditor.tsx`）

基于 Plate v52 的编辑器核心。

**Element 插件（需 withComponent 绑定渲染器）：**

| 插件 | Node Type | 渲染组件 |
|------|-----------|----------|
| `ParagraphPlugin` | `p` | `ParagraphElement` |
| `H1Plugin` | `h1` | `HeadingElement` |
| `H2Plugin` | `h2` | `HeadingElement` |
| `H3Plugin` | `h3` | `HeadingElement` |
| `BlockquotePlugin` | `blockquote` | `BlockquoteElement` |
| `HorizontalRulePlugin` | `hr` | `HrElement` |
| `CodeBlockPlugin` | `code_block` | `CodeBlockElement` |
| `CodeLinePlugin` | `code_line` | `CodeLineElement` |
| `LinkPlugin` | `a` | `LinkElement` |

**Mark 插件（内置渲染，不需要 withComponent）：**

| 插件 | Mark Key | 效果 |
|------|----------|------|
| `BoldPlugin` | `bold` | **粗体** |
| `ItalicPlugin` | `italic` | *斜体* |
| `UnderlinePlugin` | `underline` | 下划线 |
| `StrikethroughPlugin` | `strikethrough` | ~~删除线~~ |
| `CodePlugin` | `code` | `行内代码` |

**其他插件：**

| 插件 | 说明 |
|------|------|
| `ListPlugin` | 缩进式列表（非嵌套 DOM 结构） |
| `IndentPlugin` | 缩进控制（offset: 24px） |
| `SlashPlugin` + `SlashInputPlugin` | 斜杠命令菜单 |
| `AutoformatPlugin` | Markdown 快捷输入 |

**Autoformat 规则：**

| 输入 | 转换 |
|------|------|
| `# ` | Heading 1 |
| `## ` | Heading 2 |
| `### ` | Heading 3 |
| `> ` | Blockquote |
| `--- ` | Horizontal Rule |
| `**text**` / `__text__` | Bold |
| `*text*` / `_text_` | Italic |
| `~~text~~` | Strikethrough |
| `` `text` `` | Inline Code |

### Slash Menu（`slash-menu.tsx`）

输入 `/` 触发斜杠命令菜单，基于 `createPortal` 渲染到 `document.body`。

**可用块类型：**

| 分组 | 项目 | Node Type |
|------|------|-----------|
| **Text** | Paragraph | `p` |
| | Heading 1 | `h1` |
| | Heading 2 | `h2` |
| | Heading 3 | `h3` |
| **Lists** | Bulleted List | `p` + `listStyleType: disc` + `indent: 1` |
| | Numbered List | `p` + `listStyleType: decimal` + `indent: 1` |
| | To-do List | `p` + `listStyleType: disc` + `indent: 1` + `checked: false` |
| **Content** | Quote | `blockquote` |
| | Code Block | `code_block` |
| | Divider | `hr` |

**交互：**
- 关键词过滤搜索
- ↑↓ 键盘导航 + Enter 选择 + Esc 取消
- 鼠标 hover 高亮 + 点击选择
- 空内容时 Backspace 取消

### Floating Toolbar（`floating-toolbar.tsx`）

选中文本后浮现的格式化工具栏，使用 `@platejs/floating` 的 `useFloatingToolbar` 定位。

**工具按钮：**
- Bold (⌘B) · Italic (⌘I) · Underline (⌘U) · Strikethrough · | · Inline Code (⌘E)

通过 `createPortal` 渲染到 `document.body`，点击时使用 `onMouseDown` + `preventDefault()` 避免编辑器失焦。

### App Page（`DocAppPage.tsx`）

文档应用主页面，左右双栏布局。

**左侧栏（w-64）：**
- 新建按钮 + 收藏过滤 Tab
- 搜索输入框（标题搜索）
- 文档列表：显示标题、图标、收藏/置顶标记、更新时间、字数
- 悬停显示快捷操作：收藏、删除

**右侧编辑区：**
- 标题输入（`<input>` 全宽，4xl 字号，失焦/Enter 保存）
- Plate 编辑器（`<DocEditor>`，通过 `key={doc.id}` 切换文档时重建）
- 空状态：引导用户选择或新建文档

**自动保存机制：**
- 内容变更后 **800ms debounce** 自动保存
- 保存时自动计算 `wordCount` 并一并提交
- 标题失焦时立即保存

**菜单栏集成：** 通过 `useMenuBar()` 注册「文档 → 新建文档 (⌘N)」菜单项。

**错误边界：** 整个页面被 `PageErrorBoundary` 包裹，捕获编辑器崩溃并显示错误信息和重试按钮。

---

## 五、关键文件索引

### 后端

| 文件 | 说明 |
|------|------|
| `packages/rust-server/src/router/docs.rs` | 路由注册 `build_doc_routes()` |
| `packages/rust-server/src/handlers/doc.rs` | 所有 handler：CRUD + 收藏/置顶/移动/文件夹 |
| `packages/rust-server/src/services/doc_service.rs` | 业务逻辑（字数统计 `count_words`） |
| `packages/rust-server/src/db/repos/doc_repo.rs` | `DocRepo` + `DocFolderRepo` 数据库操作 |
| `packages/rust-server/src/db/models/doc.rs` | DTO：`DocOutput`、`DocListItem`、`DocFolderOutput` |
| `packages/rust-server/src/db/entities/docs.rs` | Sea-ORM entity（自动生成） |
| `packages/rust-server/src/db/entities/doc_folders.rs` | Sea-ORM entity（自动生成） |
| `prisma/schema.prisma` | Doc / DocFolder 模型定义 |

### 前端

| 文件 | 说明 |
|------|------|
| `packages/web/src/pages/dashboard/DocAppPage.tsx` | 应用主页面（双栏布局、列表、自动保存） |
| `packages/web/src/components/docs/editor/DocEditor.tsx` | Plate 编辑器核心（插件配置、渲染） |
| `packages/web/src/components/docs/editor/index.ts` | 编辑器组件 barrel export |
| `packages/web/src/components/docs/editor/slash-menu.tsx` | 斜杠命令菜单 |
| `packages/web/src/components/docs/editor/floating-toolbar.tsx` | 选区浮动格式化工具栏 |
| `packages/web/src/components/docs/editor/elements/paragraph-element.tsx` | 段落元素渲染 |
| `packages/web/src/components/docs/editor/elements/heading-element.tsx` | 标题元素渲染（H1–H3） |
| `packages/web/src/components/docs/editor/elements/blockquote-element.tsx` | 引用块渲染 |
| `packages/web/src/components/docs/editor/elements/code-block-element.tsx` | 代码块渲染 |
| `packages/web/src/components/docs/editor/elements/code-line-element.tsx` | 代码行渲染 |
| `packages/web/src/components/docs/editor/elements/link-element.tsx` | 链接元素渲染 |
| `packages/web/src/components/docs/editor/elements/hr-element.tsx` | 分割线渲染 |
| `packages/web/src/generated/rust-api/docs.ts` | API 客户端（React Query hooks） |
| `packages/web/src/generated/rust-types/DocOutput.ts` | TS 类型（ts-rs 生成） |
| `packages/web/src/generated/rust-types/DocListItem.ts` | TS 类型（ts-rs 生成） |
| `packages/web/src/generated/rust-types/DocFolderOutput.ts` | TS 类型（ts-rs 生成） |

---

## 六、API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/apps/{id}/docs` | 文档列表（分页、排序、搜索、文件夹过滤、收藏过滤） |
| `POST` | `/api/apps/{id}/docs` | 创建文档 |
| `GET` | `/api/docs/{id}` | 获取文档详情（含 content） |
| `PATCH` | `/api/docs/{id}` | 更新文档（标题 / 内容 / 图标 / 封面，自动计算字数） |
| `DELETE` | `/api/docs/{id}` | 删除文档 |
| `PATCH` | `/api/docs/{id}/favorite` | 切换收藏状态 |
| `PATCH` | `/api/docs/{id}/pin` | 切换置顶状态 |
| `PATCH` | `/api/docs/{id}/move` | 移动到文件夹（`folderId: null` 移至根目录） |
| `GET` | `/api/apps/{id}/doc-folders` | 文件夹列表（平铺，按 sortOrder + name 排序） |
| `POST` | `/api/apps/{id}/doc-folders` | 创建文件夹 |
| `PATCH` | `/api/doc-folders/{id}` | 更新文件夹（名称 / 图标 / 排序） |
| `DELETE` | `/api/doc-folders/{id}` | 删除文件夹（子文档和子文件夹移至根目录） |

---

## 七、Plate v52 技术要点

### ESM-only 架构

Plate v52 所有包均为 ESM-only，Vite 环境下无需额外配置。导入路径区分：
- 核心类型：`import { Value } from "platejs"`
- React 组件：`import { Plate, PlateContent, usePlateEditor } from "platejs/react"`
- 插件需从各自的 `/react` 入口导入

### Mark 插件自带渲染

`BoldPlugin`、`ItalicPlugin`、`UnderlinePlugin`、`StrikethroughPlugin`、`CodePlugin` 已内置叶子渲染（`<strong>`、`<em>` 等），**不要**对其调用 `.withComponent()`。

### 列表基于缩进

`ListPlugin`（`@platejs/list/react`）采用缩进式列表模型：节点仍为 `type: "p"`，通过 `listStyleType`（`disc` / `decimal`）和 `indent` 属性控制。需配合 `IndentPlugin` 使用。

### 关键 Node Type Keys

| Key | 用途 |
|-----|------|
| `p` | 段落 |
| `h1` / `h2` / `h3` | 标题 |
| `blockquote` | 引用块 |
| `hr` | 分割线 |
| `code_block` | 代码块 |
| `code_line` | 代码行（code_block 子节点） |
| `a` | 链接 |

### 关键注意事项

- ⚠️ **不要**在 `<PlateContent>` 上使用 `renderLeaf` prop — Mark 插件已内置渲染
- ⚠️ **不要**使用 `BaseIndentPlugin`（来自非 `/react` 路径）— 必须使用 `IndentPlugin` from `@platejs/indent/react`
- ⚠️ `usePlateEditor` 返回可能为 `null`（异步初始化），需做空值检查

---

## 八、后续规划

### Phase 2：丰富块类型

- 表格（Table）
- 高亮块（Callout）
- 折叠块（Toggle）
- 图片块（Image，上传到文件系统 + 内联预览）
- Emoji 选择器

### Phase 3：协作与版本

- Yjs 实时协同编辑
- 版本历史 / 快照
- 文档模板
- 导出（PDF / Markdown / HTML）

### Phase 4：高级功能

- 看板视图（Kanban）
- 流程图 / 思维导图（嵌入式绘图）
- 外部内容嵌入（视频、网页、文件）
- 评论 / 批注系统
