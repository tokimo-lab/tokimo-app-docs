/**
 * Document templates — pre-built Slate JSON content for new documents.
 *
 * Node types match the Plate v52 plugins configured in DocEditor.tsx:
 *   p, h1, h2, h3, blockquote, hr, callout, table/tr/th/td
 *   Indent-based lists: type "p" + listStyleType + indent + optional checked
 */

import type { Value } from "platejs";

export interface DocTemplate {
  id: string;
  /** Display name (Chinese) */
  name: string;
  /** Short description (Chinese) */
  description: string;
  /** Lucide icon name — mapped to component in the chooser */
  icon: string;
  /** Default document title */
  title: string;
  /** Slate JSON content */
  content: Value;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const p = (text: string, opts?: Record<string, unknown>) =>
  ({ type: "p", children: [{ text }], ...opts }) as unknown as Value[number];

const h1 = (text: string) =>
  ({ type: "h1", children: [{ text }] }) as unknown as Value[number];

const h2 = (text: string) =>
  ({ type: "h2", children: [{ text }] }) as unknown as Value[number];

const h3 = (text: string) =>
  ({ type: "h3", children: [{ text }] }) as unknown as Value[number];

const hr = () =>
  ({ type: "hr", children: [{ text: "" }] }) as unknown as Value[number];

const blockquote = (text: string) =>
  ({ type: "blockquote", children: [{ text }] }) as unknown as Value[number];

const callout = (text: string, variant: string = "info") =>
  ({
    type: "callout",
    variant,
    children: [{ text }],
  }) as unknown as Value[number];

const todo = (text: string, checked = false) =>
  ({
    type: "p",
    listStyleType: "disc",
    indent: 1,
    checked,
    children: [{ text }],
  }) as unknown as Value[number];

const bullet = (text: string) =>
  ({
    type: "p",
    listStyleType: "disc",
    indent: 1,
    children: [{ text }],
  }) as unknown as Value[number];

const numbered = (text: string) =>
  ({
    type: "p",
    listStyleType: "decimal",
    indent: 1,
    children: [{ text }],
  }) as unknown as Value[number];

const tableRow = (cells: string[], header = false) => ({
  type: "tr",
  children: cells.map((text) => ({
    type: header ? "th" : "td",
    children: [{ text }],
  })),
});

const table = (headers: string[], ...rows: string[][]) =>
  ({
    type: "table",
    children: [tableRow(headers, true), ...rows.map((row) => tableRow(row))],
  }) as unknown as Value[number];

// ── Templates ────────────────────────────────────────────────────────────────

export const DOC_TEMPLATES: DocTemplate[] = [
  // 1. Blank
  {
    id: "blank",
    name: "空白文档",
    description: "从空白页面开始",
    icon: "FileText",
    title: "",
    content: [p("")],
  },

  // 2. Meeting Notes
  {
    id: "meeting-notes",
    name: "会议记录",
    description: "记录会议议程、讨论与行动项",
    icon: "Calendar",
    title: "会议记录",
    content: [
      h1("会议记录"),
      h3("基本信息"),
      bullet("日期："),
      bullet("时间："),
      bullet("地点："),
      bullet("主持人："),
      p(""),
      h3("参会人员"),
      bullet(""),
      p(""),
      h2("议程"),
      numbered("议题一"),
      numbered("议题二"),
      numbered("议题三"),
      p(""),
      h2("会议纪要"),
      p(""),
      p(""),
      h2("行动项"),
      todo("待办事项 1 — 负责人："),
      todo("待办事项 2 — 负责人："),
      todo("待办事项 3 — 负责人："),
      p(""),
      h3("下次会议"),
      p("时间：待定"),
    ],
  },

  // 3. Weekly Report
  {
    id: "weekly-report",
    name: "周报",
    description: "本周总结、下周计划与阻塞事项",
    icon: "ClipboardList",
    title: "周报",
    content: [
      h1("周报"),
      p(""),
      h2("📋 本周工作"),
      numbered(""),
      numbered(""),
      numbered(""),
      p(""),
      h2("📅 下周计划"),
      numbered(""),
      numbered(""),
      numbered(""),
      p(""),
      h2("🚧 阻塞 / 风险"),
      callout("如无阻塞可删除此部分", "warning"),
      bullet(""),
      p(""),
      h2("💡 总结与思考"),
      p(""),
    ],
  },

  // 4. Project Plan
  {
    id: "project-plan",
    name: "项目计划",
    description: "项目概述、里程碑、分工与时间线",
    icon: "LayoutTemplate",
    title: "项目计划",
    content: [
      h1("项目计划"),
      p(""),
      h2("项目概述"),
      p("简要描述项目背景、目标和范围。"),
      p(""),
      h2("里程碑"),
      table(
        ["里程碑", "目标日期", "状态"],
        ["需求评审", "", "待开始"],
        ["设计完成", "", "待开始"],
        ["开发完成", "", "待开始"],
        ["测试上线", "", "待开始"],
      ),
      p(""),
      h2("分工"),
      table(["负责人", "职责", "备注"], ["", "", ""], ["", "", ""]),
      p(""),
      h2("时间线"),
      numbered("第 1 周：需求确认"),
      numbered("第 2-3 周：设计与评审"),
      numbered("第 4-6 周：开发"),
      numbered("第 7 周：测试"),
      numbered("第 8 周：上线"),
      p(""),
      h2("风险与依赖"),
      bullet(""),
    ],
  },

  // 5. TODO List
  {
    id: "todo-list",
    name: "待办清单",
    description: "按优先级分类的待办事项",
    icon: "ListChecks",
    title: "待办清单",
    content: [
      h1("待办清单"),
      p(""),
      h2("🔴 紧急 / 重要"),
      todo(""),
      todo(""),
      p(""),
      h2("🟡 重要 / 不紧急"),
      todo(""),
      todo(""),
      p(""),
      h2("🔵 紧急 / 不重要"),
      todo(""),
      p(""),
      h2("⚪ 不紧急 / 不重要"),
      todo(""),
      p(""),
      hr(),
      callout("按照四象限法则安排优先级", "tip"),
    ],
  },

  // 6. Technical Design
  {
    id: "tech-design",
    name: "技术方案",
    description: "技术背景、目标、设计方案与评估",
    icon: "Lightbulb",
    title: "技术方案",
    content: [
      h1("技术方案"),
      p(""),
      h2("背景"),
      p("描述当前问题和为什么需要这个方案。"),
      p(""),
      h2("目标"),
      bullet("目标 1"),
      bullet("目标 2"),
      p(""),
      h2("非目标"),
      bullet(""),
      p(""),
      h2("方案设计"),
      h3("整体架构"),
      p(""),
      h3("核心流程"),
      numbered("步骤 1"),
      numbered("步骤 2"),
      numbered("步骤 3"),
      p(""),
      h3("数据模型"),
      p(""),
      p(""),
      h2("备选方案"),
      table(["方案", "优点", "缺点"], ["方案 A", "", ""], ["方案 B", "", ""]),
      p(""),
      h2("风险评估"),
      callout("列出可能的风险及缓解措施", "warning"),
      bullet(""),
      p(""),
      h2("实施计划"),
      todo("阶段一"),
      todo("阶段二"),
      todo("阶段三"),
    ],
  },

  // 7. Reading Notes
  {
    id: "reading-notes",
    name: "读书笔记",
    description: "记录书籍要点、摘录与感悟",
    icon: "BookOpen",
    title: "读书笔记",
    content: [
      h1("读书笔记"),
      p(""),
      h3("书籍信息"),
      bullet("书名："),
      bullet("作者："),
      bullet("出版年份："),
      bullet("阅读日期："),
      p(""),
      hr(),
      h2("📌 核心观点"),
      numbered(""),
      numbered(""),
      numbered(""),
      p(""),
      h2("📝 精彩摘录"),
      blockquote("在这里记录书中的精彩段落…"),
      p(""),
      blockquote(""),
      p(""),
      h2("💡 个人感悟"),
      p(""),
      p(""),
      h2("⭐ 评分"),
      p("推荐指数：⭐⭐⭐⭐⭐"),
      p(""),
      h2("📋 行动计划"),
      todo("读完后要做的事 1"),
      todo("读完后要做的事 2"),
    ],
  },

  // 8. Daily Journal
  {
    id: "daily-journal",
    name: "日记",
    description: "记录每日事件、心情与反思",
    icon: "Pencil",
    title: "日记",
    content: [
      h1("日记"),
      p(""),
      h3("📅 日期"),
      p(""),
      h3("🌤 心情"),
      p(""),
      p(""),
      hr(),
      h2("今日记录"),
      p(""),
      p(""),
      h2("感恩清单"),
      numbered(""),
      numbered(""),
      numbered(""),
      p(""),
      h2("反思"),
      blockquote("今天最大的收获是什么？"),
      p(""),
      p(""),
      h2("明日目标"),
      todo(""),
      todo(""),
      todo(""),
    ],
  },
];
