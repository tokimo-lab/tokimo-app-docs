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
| `search_text` | `Text?` | 从 Slate JSON 提取的纯文本（全文搜索用） |
| `tags` | `String[]` | 文档标签数组 |
| `icon` | `String?` | 文档 emoji 图标 |
| `cover_image` | `String?` | 封面图片 URL |
| `is_favorite` | `Boolean` | 收藏标记 |
| `is_pinned` | `Boolean` | 置顶标记 |
| `is_archived` | `Boolean` | 归档标记（列表查询默认排除） |
| `word_count` | `Int` | 字数统计 |
| `created_at` | `Timestamptz` | 创建时间 |
| `updated_at` | `Timestamptz` | 更新时间 |

### DocFolder 表（`doc_folders`）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `UUID` (PK) | 文件夹 ID |
| `app_id` | `UUID` (FK → App) | 所属应用 |
| `parent_id` | `UUID?` (FK → self) | 父文件夹，NULL 表示顶层 |
| `name` | `String` | 文件夹名称 |
| `icon` | `String?` | emoji 图标 |
| `sort_order` | `Int` | 排序序号 |
| `created_at` | `Timestamptz` | 创建时间 |
| `updated_at` | `Timestamptz` | 更新时间 |

### DocVersion 表（`doc_versions`）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `UUID` (PK) | 版本 ID |
| `doc_id` | `UUID` (FK → Doc, CASCADE) | 所属文档 |
| `version` | `Int` | 版本号（每文档自增） |
| `title` | `String` | 快照时的标题 |
| `content` | `Json?` | 快照时的 Slate JSON |
| `word_count` | `Int` | 快照时的字数 |
| `created_at` | `Timestamptz` | 创建时间 |

**自动快照策略**：内容保存时检查上一版本时间，间隔 ≥ 10 分钟才创建新版本。每文档保留最新 50 个版本。

### 内容存储格式

`content` 列存储 Slate 节点数组（Value），示例：

```json
[
  { "type": "h1", "children": [{ "text": "标题" }] },
  { "type": "p", "children": [{ "text": "正文内容，", "bold": true }, { "text": "普通文字" }] },
  { "type": "blockquote", "children": [{ "text": "引用文本" }] },
  { "type": "equation", "texExpression": "E = mc^2", "children": [{ "text": "" }] },
  { "type": "mermaid", "code": "graph TD\n  A --> B", "children": [{ "text": "" }] }
]
```

### 字数统计算法

`DocService::count_words()` — 递归遍历 Slate 节点提取 `text` 字段：
- **CJK 字符**：每个字符计 1 字
- **拉丁文本**：按空白符分词计数
- 保存时同步提取 `search_text`（纯文本副本）用于全文搜索

---

## 三、后端分层

遵循 `Router → Handler → Service → Repo → Entity` 架构。

### DTO 类型

| DTO | 用途 | 方式 |
|-----|------|------|
| `DocListItem` | 列表视图（不含 content） | `DerivePartialModel` |
| `DocOutput` | 完整详情（含 content） | `From<docs::Model>` |
| `DocFolderOutput` | 文件夹 | `DerivePartialModel` |
| `DocVersionOutput` | 版本列表（不含 content） | `DerivePartialModel` |
| `DocVersionDetailOutput` | 版本详情（含 content） | `From<doc_versions::Model>` |

---

## 四、前端架构

### 编辑器插件（30+）

**Element 插件：**

| 插件 | Node Type | 渲染组件 |
|------|-----------|----------|
| `ParagraphPlugin` | `p` | `ParagraphElement` |
| `H1/H2/H3Plugin` | `h1`/`h2`/`h3` | `HeadingElement` |
| `BlockquotePlugin` | `blockquote` | `BlockquoteElement` |
| `HorizontalRulePlugin` | `hr` | `HrElement` |
| `CodeBlockPlugin` | `code_block` | `CodeBlockElement` |
| `CodeLinePlugin` | `code_line` | `CodeLineElement` |
| `LinkPlugin` | `a` | `LinkElement` |
| `ImagePlugin` | `img` | `ImageElement` |
| `TablePlugin` | `table` | `TableElement` |
| `CalloutPlugin` | `callout` | `CalloutElement` |
| `TogglePlugin` | `toggle` | `ToggleElement` |
| `ColumnPlugin` | `column` | `ColumnElement` |
| `TocPlugin` | `toc` | `TocElement` |
| `EquationPlugin` | `equation` | `EquationElement` (KaTeX) |
| `InlineEquationPlugin` | `inline_equation` | `InlineEquationElement` |
| `DatePlugin` | `date` | `DateElement` (native picker) |
| `MentionPlugin` | `mention` | `MentionElement` |
| `MentionInputPlugin` | `mention_input` | `MentionInputElement` |
| `EmojiPlugin`/`EmojiInputPlugin` | — | `EmojiInputElement` |
| `MermaidPlugin` (custom) | `mermaid` | `MermaidElement` |
| `CommentPlugin` | — (mark) | `CommentLeaf` |

**Mark 插件**（内置渲染）：Bold, Italic, Underline, Strikethrough, Code, Highlight, Superscript, Subscript, Kbd

**功能插件**：ListPlugin, IndentPlugin, SlashPlugin, AutoformatPlugin, DndPlugin, DocxPlugin

### Slash Menu（25+ 项）

| 分组 | 项目 |
|------|------|
| **Text** | Paragraph, H1, H2, H3 |
| **Lists** | Bulleted, Numbered, To-do, Toggle |
| **Content** | Quote, Code Block, Divider, Table, Callout, Image |
| **Layout** | 2-Column, 3-Column, Table of Contents |
| **Advanced** | Equation, Inline Equation, Date, @Mention, :Emoji, Mermaid |

### Floating Toolbar

选中文本浮现：Bold · Italic · Underline · Strikethrough · Code · Highlight · Link · Turn Into (块类型切换) · Comment

### App Page（`DocAppPage.tsx`）

文档应用主页面，左右双栏布局。

**左侧栏：**
- Tab 切换：全部 / 收藏 / 文件夹树 / 回收站
- 搜索输入框（标题 + 标签搜索）
- 文档列表：标题、图标、收藏/置顶、更新时间、字数
- 文件夹树视图：拖拽排序、右键菜单
- 回收站：恢复 / 永久删除

**右侧编辑区：**
- 标题输入 + 标签编辑器
- Plate 编辑器
- 版本历史侧边栏（Clock 图标切换）
- 评论侧边栏（MessageSquare 图标切换）
- 空状态引导

**自动保存：** 内容变更后 800ms debounce 自动保存，同时更新 word_count + search_text。

**模板系统：** 新建文档时弹出模板选择器（8 种模板），选择后自动填充内容。

**Markdown 导入/导出：** 菜单栏集成，使用 `@platejs/markdown` 的 `serializeMd`/`deserializeMd`。

---

## 五、关键文件索引

### 后端

| 文件 | 说明 |
|------|------|
| `router/docs.rs` | 路由注册 |
| `handlers/doc.rs` | Handler：CRUD + 收藏/置顶/移动/归档/恢复/版本历史 |
| `services/doc_service.rs` | 业务逻辑：字数统计、文本提取、版本快照 |
| `db/repos/doc_repo.rs` | `DocRepo` + `DocFolderRepo` + `DocVersionRepo` |
| `db/models/doc.rs` | DTO 输出类型 |
| `db/entities/docs.rs` | Sea-ORM entity |
| `db/entities/doc_folders.rs` | Sea-ORM entity |
| `db/entities/doc_versions.rs` | Sea-ORM entity |

### 前端

| 文件 | 说明 |
|------|------|
| `pages/dashboard/DocAppPage.tsx` | 主页面 |
| `pages/dashboard/DocSidebar.tsx` | 侧边栏（Tab + 搜索 + 列表） |
| `pages/dashboard/DocSidebarTree.tsx` | 文件夹树 + 文档行 + 归档行 |
| `components/docs/editor/DocEditor.tsx` | Plate 编辑器核心 |
| `components/docs/editor/slash-menu.tsx` | 斜杠命令菜单 |
| `components/docs/editor/floating-toolbar.tsx` | 浮动格式化工具栏 |
| `components/docs/editor/elements/*.tsx` | 各类型元素渲染组件 (20+) |
| `components/docs/DocTemplateChooser.tsx` | 模板选择器 |
| `components/docs/DocTagInput.tsx` | 标签编辑器 |
| `components/docs/DocVersionHistory.tsx` | 版本历史侧边栏 |
| `components/docs/CommentSidebar.tsx` | 评论侧边栏 |
| `components/docs/doc-templates.ts` | 模板定义（8 种） |
| `generated/rust-api/docs.ts` | API 客户端 |
| `generated/rust-types/Doc*.ts` | TS 类型（ts-rs 生成） |

---

## 六、API 端点

### 文档 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/apps/{id}/docs` | 文档列表（分页、排序、搜索、文件夹/收藏/归档过滤） |
| `POST` | `/api/apps/{id}/docs` | 创建文档 |
| `GET` | `/api/docs/{id}` | 获取详情（含 content） |
| `PATCH` | `/api/docs/{id}` | 更新（标题/内容/图标/封面/标签） |
| `DELETE` | `/api/docs/{id}` | 归档（软删除） |
| `PATCH` | `/api/docs/{id}/favorite` | 切换收藏 |
| `PATCH` | `/api/docs/{id}/pin` | 切换置顶 |
| `PATCH` | `/api/docs/{id}/move` | 移动到文件夹 |
| `PATCH` | `/api/docs/{id}/restore` | 从归档恢复 |
| `DELETE` | `/api/docs/{id}/permanent` | 永久删除 |

### 文件夹

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/apps/{id}/doc-folders` | 文件夹列表 |
| `POST` | `/api/apps/{id}/doc-folders` | 创建文件夹 |
| `PATCH` | `/api/doc-folders/{id}` | 更新文件夹 |
| `DELETE` | `/api/doc-folders/{id}` | 删除文件夹 |

### 版本历史

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/docs/{id}/versions` | 版本列表（不含 content） |
| `GET` | `/api/doc-versions/{id}` | 版本详情（含 content） |
| `POST` | `/api/docs/{id}/versions/{vid}/restore` | 恢复到指定版本 |

---

## 七、Plate v52 技术要点

### ESM-only

Plate v52 所有包均为 ESM-only。导入路径区分：
- 核心类型：`import { Value } from "platejs"`
- React 组件：`import { Plate, PlateContent, usePlateEditor } from "platejs/react"`
- 插件从 `@platejs/xxx/react` 导入

### Mark 插件自带渲染

Bold/Italic/Underline/Strikethrough/Code 已内置叶子渲染，**不要**对其调用 `.withComponent()`。

### 列表基于缩进

`ListPlugin` 采用缩进式列表：节点为 `type: "p"` + `listStyleType` + `indent`，配合 `IndentPlugin`。

### Void 元素

Equation、Mermaid、Image 等为 void 元素（`isVoid: true`），内容不可直接编辑，通过自定义 UI 交互。

### 自定义插件模式

```tsx
import { createSlatePlugin } from "platejs";
const MermaidPlugin = createSlatePlugin({
  key: "mermaid",
  node: { isElement: true, isVoid: true },
});
// 注册：MermaidPlugin.withComponent(MermaidElement)
```

---

## 八、后续规划

### Phase 4（进行中）

- AI 集成（@platejs/ai + Tokimo /api/ai/*）
- Yjs 实时协同编辑
- Track Changes / Suggest 模式
- DOCX 导出（programmatic）

### Phase 5

- 看板视图（Kanban）
- 思维导图
- 外部内容嵌入
- 文档权限管理
