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

### 编辑器插件（36+）

**Element 插件：**

| 插件 | Node Type | 渲染组件 |
|------|-----------|----------|
| `ParagraphPlugin` | `p` | `ParagraphElement` |
| `H1/H2/H3Plugin` | `h1`/`h2`/`h3` | `HeadingElement` |
| `H4/H5/H6Plugin` | `h4`/`h5`/`h6` | `HeadingElement` |
| `BlockquotePlugin` | `blockquote` | `BlockquoteElement` |
| `HorizontalRulePlugin` | `hr` | `HrElement` |
| `CodeBlockPlugin` | `code_block` | `CodeBlockElement` |
| `CodeLinePlugin` | `code_line` | `CodeLineElement` |
| `LinkPlugin` | `a` | `LinkElement` |
| `ImagePlugin` | `img` | `ImageElement` |
| `VideoPlugin` (custom) | `video` | `VideoElement` |
| `AudioPlugin` (custom) | `audio` | `AudioElement` |
| `FilePlugin` (custom) | `file` | `FileElement` |
| `MediaEmbedPlugin` | `media_embed` | `MediaEmbedElement` |
| `BookmarkPlugin` (custom) | `bookmark` | `BookmarkElement` |
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

### Slash Menu（29+ 项）

| 分组 | 项目 |
|------|------|
| **Text** | Paragraph, H1, H2, H3, H4, H5, H6 |
| **Lists** | Bulleted, Numbered, To-do, Toggle |
| **Content** | Quote, Code Block, Divider, Table, Callout, Image |
| **Media** | Video, Audio, File, Media Embed, Bookmark, VFS File Reference |
| **Layout** | 2-Column, 3-Column, Table of Contents |
| **Advanced** | Equation, Inline Equation, Date, @Mention, :Emoji, Mermaid |
| **AI** | 润色、翻译(中/英)、总结、续写、修正语法 |

### Floating Toolbar

选中文本浮现：Bold · Italic · Underline · Strikethrough · Code · Highlight · Link · Turn Into (块类型切换) · Comment · AI 助手（润色/翻译/总结/续写/语法修正）

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
| `services/ai/builtin_tools.rs` | AI 内置工具定义（edit_document） |

### 前端

| 文件 | 说明 |
|------|------|
| `pages/dashboard/DocAppPage.tsx` | 主页面 |
| `pages/dashboard/DocSidebar.tsx` | 侧边栏（Tab + 搜索 + 列表） |
| `pages/dashboard/DocSidebarTree.tsx` | 文件夹树 + 文档行 + 归档行 |
| `components/docs/editor/DocEditor.tsx` | Plate 编辑器核心 |
| `components/docs/editor/slash-menu.tsx` | 斜杠命令菜单 |
| `components/docs/editor/floating-toolbar.tsx` | 浮动格式化工具栏 |
| `components/docs/editor/elements/*.tsx` | 各类型元素渲染组件 (26+) |
| `components/docs/editor/VfsFilePickerModal.tsx` | VFS 文件选择器 |
| `components/docs/DocTemplateChooser.tsx` | 模板选择器 |
| `components/docs/DocTagInput.tsx` | 标签编辑器 |
| `components/docs/DocVersionHistory.tsx` | 版本历史侧边栏 |
| `components/docs/CommentSidebar.tsx` | 评论侧边栏 |
| `components/docs/doc-templates.ts` | 模板定义（8 种） |
| `generated/rust-api/docs.ts` | API 客户端 |
| `generated/rust-types/Doc*.ts` | TS 类型（ts-rs 生成） |
| `lib/ai-assistant-events.ts` | AI 助手事件桥（open/edit/context 事件） |
| `components/ai-chat/hooks/useClientTools.ts` | 客户端工具执行 hook |

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

## 八、Phase 4-5 已完成功能

### Phase 4：AI 与高级功能 ✅

#### AI 集成

文档编辑器通过系统级 AI 助手实现 AI 功能（非独立面板）：

- **上下文传递**：从文档打开 AI 助手时，自动提取编辑器全文并作为上下文注入
  - `getEditorText()` 递归遍历 Slate 节点提取纯文本
  - 通过 `openAiAssistant({ context, contextLabel })` 事件传递
  - AI 消息格式：`[以下是当前文档内容]\n\n{文档全文}\n\n[用户请求]\n{用户消息}`
  - UI 显示上下文徽章（"已附加：{文档标题}"），可手动解除
- **AI 操作菜单**：浮动工具栏集成 AI 操作（润色、翻译、总结、续写、修正语法）
  - 选中文本后通过 `handleAiAction()` 构建 prompt 发送

#### Mermaid 图表

- 自定义 `MermaidPlugin`（`createSlatePlugin`，isVoid + isElement）
- `MermaidElement`：代码编辑器 + 实时 Mermaid 渲染预览
- Slash menu 入口：`/mermaid`

#### DOCX 导出

- 使用 `docx` + `file-saver` npm 包
- Slate JSON → `docx.Document` 编程式转换
- 支持：标题层级、列表、表格、代码块、引用、链接、图片（base64 嵌入）

#### DOCX 粘贴

- `@platejs/docx` 插件自动清理 Word 粘贴内容
- 保留结构化元素（标题、列表、表格）

### Phase 5：扩展块类型 ✅

| 块类型 | 插件 | 节点类型 | 渲染组件 | Slash 入口 |
|--------|------|----------|----------|------------|
| H4-H6 标题 | `H4Plugin`/`H5Plugin`/`H6Plugin` | `h4`/`h5`/`h6` | `HeadingElement` | `/h4`、`/h5`、`/h6` |
| 视频 | `VideoPlugin` (custom) | `video` | `VideoElement` | `/video` |
| 音频 | `AudioPlugin` (custom) | `audio` | `AudioElement` | `/audio` |
| 文件附件 | `FilePlugin` (custom) | `file` | `FileElement` | `/file` |
| 媒体嵌入 | `MediaEmbedPlugin` | `media_embed` | `MediaEmbedElement` | `/embed` |
| 书签链接卡 | `BookmarkPlugin` (custom) | `bookmark` | `BookmarkElement` | `/bookmark` |

#### VFS 文件引用

- 从系统 VFS（虚拟文件系统）引用文件，通过 `VfsFilePickerModal` 选择
- 文件类型自动识别 → 插入对应块类型（图片→img、视频→video、音频→audio、其他→file）
- Slash menu 入口：`/vfs` 或 `/文件引用`
- 前端通过 `onInsertVfsFile` 回调集成到 `DocEditorContext`

---

## 九、系统 AI 助手集成

文档应用的 AI 功能通过 Tokimo 系统级 AI 助手实现，而非内嵌独立 AI 面板。

### 架构

```
DocAppPage
  ├── handleOpenAi()         → 提取文档全文 → openAiAssistant(context)
  ├── handleAiAction(type)   → 构建特定 prompt → openAiAssistant(prompt)
  ├── getSelectedText()      → 获取选中文本
  └── onAiEditDocument       → 监听 AI 编辑事件 → 替换编辑器内容 → 显示撤销栏

         ↓ CustomEvent("open-ai-assistant")

MenuBar → AiAssistant (系统级浮窗, 不自动关闭)
  ├── 接收 context/contextLabel
  ├── buildContent(message)  → 拼接上下文 + 用户消息
  ├── 发送至 /api/ai/chat/stream
  └── tool_call: edit_document → useClientTools → CustomEvent("ai-edit-document")
                                                     ↓
                                                DocAppPage → deserializeMd → 替换内容 → 撤销栏
```

### 入口

1. **工具栏按钮**：编辑区右上角 `Sparkles` 图标 → 调用 `handleOpenAi()` 传递文档全文
2. **浮动工具栏**：选中文本后 AI 菜单 → 调用 `handleAiAction(type)` 传递选中文本 + prompt
3. **Slash 命令**：`/ai` 系列命令（润色、翻译、总结、续写、语法修正）

### AI 操作类型

| 类型 | Prompt | 说明 |
|------|--------|------|
| `polish` | 润色以下文本... | 文字润色 |
| `translate-en` | 翻译为英文... | 翻译 |
| `translate-zh` | 翻译为中文... | 翻译 |
| `summarize` | 总结要点... | 摘要 |
| `continue` | 续写... | 续写 |
| `fix-grammar` | 修正语法... | 语法修正 |

### AI 直接编辑文档

AI 助手可通过 `edit_document` 工具直接修改文档内容，实现"对话即编辑"的交互模式。

#### 工具定义

后端 `builtin_tools.rs` 定义了 `edit_document` 内置工具，仅在以下条件同时满足时被 AI 调用：
- 对话上下文中附带了文档内容（用户从文档应用打开 AI 助手）
- 用户明确要求修改/重新格式化/重写文档

#### 完整流程

```
1. 用户在文档编辑器中打开 AI 助手（附带文档上下文）
2. 用户发送编辑指令（如"把这篇文档翻译成英文"）
3. AI 决定调用 edit_document tool
4. 后端通过 SSE 发送 tool_call 事件（含 content 和 summary 参数）
5. 前端 useClientTools hook 接收 tool_call
6. 触发 CustomEvent("ai-edit-document")，携带 markdown content
7. DocAppPage 监听事件 → @platejs/markdown deserializeMd → 替换 Slate 编辑器内容
8. 底部显示撤销栏
```

#### 撤销机制

- 执行编辑前保存当前编辑器内容（pre-edit snapshot）
- 底部弹出撤销栏："AI 已编辑文档 · 撤销"按钮
- 一键点击恢复 pre-edit 内容，撤销 AI 的所有修改

#### 上下文显示优化

- 包含 `[以下是当前文档内容]` 前缀的用户消息，在聊天气泡中自动剥离文档原文
- 替换为紧凑的 `引用当前文档` 标签徽章，避免大段文档文本占据聊天界面
- 相同的剥离逻辑应用于 markdown 导出

#### 面板行为

- AI 面板不再因外部点击自动关闭（`useDismiss` 中禁用了 `outsidePress`）
- 用户经常在 AI 面板和文档编辑器之间切换，自动关闭体验不佳
- 仍可通过 Escape 键关闭面板

---

## 十、后续规划

### 已推迟

- **Yjs 实时协同**：需要 WebSocket + Yjs 基础设施，单用户场景优先级低
- **Track Changes**：Plate 无官方 suggestion 插件，需自建复杂

### 未来迭代

- 数据库视图（看板/画廊/日历）
- 同步块（Synced Block）
- 高级表格（列宽调整、排序）
- 画板/思维导图
- 演示模式
