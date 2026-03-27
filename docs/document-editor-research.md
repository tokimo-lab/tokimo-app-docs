# 文档编辑器选型调研报告

> 调研日期：2026-03-27
> 目标：实现类似飞书文档 / Notion 的块编辑器功能

---

## 一、Notion & 飞书文档 功能全览

### Notion 全部内容块类型

| 分类 | 块类型 |
|------|--------|
| **文本** | Paragraph, Heading 1/2/3, Quote, Callout |
| **列表** | Bulleted List, Numbered List, To-Do, Toggle (折叠) |
| **媒体** | Image, Video, Audio, File, PDF, Embed (500+源), Bookmark, Link Preview |
| **代码/公式** | Code Block (语法高亮), Equation (LaTeX) |
| **数据库视图** | Table, Board (看板), Gallery, Calendar, Timeline, List, Feed (2025新增), Chart |
| **数据库属性** | Text, Number, Select, Multi-Select, Date, Person, Checkbox, URL, Email, Phone, Relation, Rollup, Formula, Files, Status |
| **布局** | Column List / Column (多栏), Divider, Table of Contents, Breadcrumb |
| **高级** | Synced Block (同步块), Template Button, Child Page, Child Database, Link to Page |
| **协作** | 实时多人编辑、评论、@提及、版本历史、AI 问答/摘要 |

### 飞书文档全部内容块类型

| 分类 | 块类型 |
|------|--------|
| **文本** | 段落、1~9级标题、引用块 |
| **列表** | 有序/无序列表、待办任务清单 |
| **高亮/提示** | 高亮块 (Callout)、分割线 |
| **代码/公式** | 代码块 (70+语言高亮)、公式块 (LaTeX) |
| **表格** | 普通表格、多维表格 (Bitable，类 Airtable)、电子表格 (Sheet) |
| **视觉图形** | 图片、文件、画板 (Artboard)、思维导图 (Mindnote)、流程图/UML |
| **协作互动** | 投票块、会话卡片、第三方小组件 (ISV) |
| **布局** | 分栏 (Grid/GridColumn)、引用容器 |
| **嵌入** | Iframe (网页/第三方嵌入)、抖音/B站/Figma 等 |
| **协作** | 实时多人编辑、评论批注、@同事、演示模式 (PPT)、版本历史、翻译、模板库 |

**飞书独有**：画板、思维导图、投票、演示模式、9级标题、多维表格
**Notion独有**：Synced Block、双向 Relation/Rollup、Formula、6种数据库视图、Feed

---

## 二、主流编辑器库对比

| 维度 | **Plate** | **BlockNote** | **Tiptap** | **Novel** |
|------|-----------|---------------|------------|-----------|
| **底层引擎** | Slate | ProseMirror + Tiptap | ProseMirror | Tiptap |
| **UI 方式** | Headless + shadcn/ui 组件 | 内置 Notion 风格 UI | Headless | 内置 UI |
| **React 支持** | ✅ 原生 | ✅ 原生 | ✅ (也支持 Vue/Svelte) | ✅ Next.js |
| **自定义块** | ✅ 插件系统，极强 | ✅ createReactBlockSpec | ✅ Extension | ⚠️ 有限 |
| **协作 (Yjs)** | ✅ 内置 | ✅ 内置 | ✅ 内置 | ❌ |
| **AI 集成** | ✅ AI Chat/Menu/Copilot/Suggest | ⚠️ 插件级 | ✅ Pro 功能 | ✅ OpenAI 补全 |
| **评论/批注** | ✅ 内联+侧边栏 | ✅ (Liveblocks) | ✅ Pro | ❌ |
| **Track Changes** | ✅ Suggest 模式 | 🔜 Coming | ✅ Pro | ❌ |
| **表格** | ✅ 全功能 (可调宽/拖拽行) | ✅ 基础表格 | ✅ 全功能 | ⚠️ 基础 |
| **Slash 命令** | ✅ | ✅ | ✅ | ✅ |
| **拖拽排序** | ✅ | ✅ | ✅ Extension | ⚠️ |
| **多栏布局** | ✅ Column | ✅ xl-multi-column | ✅ Extension | ❌ |
| **代码块高亮** | ✅ | ✅ | ✅ | ✅ |
| **数学公式** | ✅ KaTeX | ⚠️ 需自定义 | ✅ Extension | ❌ |
| **Callout** | ✅ | ⚠️ 需自定义块 | ✅ Extension | ❌ |
| **TOC 目录** | ✅ | ❌ | ✅ Extension | ❌ |
| **DOCX 导入/导出** | ✅ @platejs/docx-io | ❌ | ❌ | ❌ |
| **Markdown 导入/导出** | ✅ | ✅ | ✅ | ✅ |
| **Mermaid/图表** | ✅ (PlantUML/Graphviz/Mermaid/Flowchart) | ❌ | ❌ | ❌ |
| **Emoji 选择器** | ✅ | ❌ | ✅ Extension | ❌ |
| **@Mention** | ✅ | ⚠️ 需自定义 | ✅ Extension | ❌ |
| **版本历史** | ✅ Pro | 🔜 | ✅ Pro | ❌ |
| **社区/生态** | 大 (Slate 生态) | 成长中 | 最大 | 中等 |
| **License** | MIT | MPL-2.0 / GPL-3.0 (XL) | MIT (核心) | AGPL-3.0 |
| **UI 框架兼容** | shadcn/ui + Tailwind ✅ | 自有UI (可覆盖) | 无关 | 自有UI |

---

## 三、推荐结论

### 🏆 推荐：Plate

理由：

1. **功能最全面**：唯一同时覆盖 AI (Chat/Copilot/Suggest)、协作 (Yjs)、评论、Track Changes、表格、公式、Mermaid 图表、DOCX 导入导出、Callout、TOC 等飞书/Notion 级功能的开源编辑器

2. **与 Tokimo 技术栈完美匹配**：
   - 基于 shadcn/ui + Tailwind CSS（Tokimo 用的正是 Tailwind v4）
   - React 原生，TypeScript 全类型
   - Headless 架构 = 完全控制 UI，不会和自研组件库冲突

3. **扩展性最强**：插件式架构，每个功能独立 plugin，想要什么加什么，不要的不打包

4. **AI 能力内置**：AI Chat、AI Menu、Copilot 补全、AI 评论、Suggest/Accept/Reject，后续接 `/api/ai/*` 非常自然

5. **活跃维护**：2026年3月仍在频繁更新，社区活跃

### 次选：BlockNote

如果只需要快速出一个 Notion 风格编辑器且功能需求不多，BlockNote 开箱即用体验更好。但它缺少公式、Callout、图表、DOCX、AI 等高级功能，后续扩展会遇到瓶颈。

---

## 四、参考链接

- Plate: https://platejs.org/
- BlockNote: https://www.blocknotejs.org/
- Tiptap: https://tiptap.dev/
- Novel: https://novel.sh/
- Notion 块类型: https://www.notion.com/help/guides/types-of-content-blocks
- 飞书文档 API: https://open.feishu.cn/document/server-docs/docs/docs/docx-v1/docx-overview
