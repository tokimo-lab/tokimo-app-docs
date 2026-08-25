import {
  ArrowRight,
  AtSign,
  Calendar,
  CheckSquare,
  ChevronRight,
  Code,
  Columns2,
  ExternalLink,
  FileIcon,
  GitBranch,
  HardDrive,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Image,
  Info,
  Languages,
  List,
  ListOrdered,
  Minus,
  Music,
  Quote,
  Sigma,
  Smile,
  Sparkles,
  Superscript,
  Table,
  TableOfContents,
  Type,
  Video,
  Wand2,
  Zap,
} from "lucide-react";
import type { TElement } from "platejs";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useEditorRef, useElement } from "platejs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDocEditorContext } from "./DocEditor";

interface SlashMenuItem {
  icon: React.ReactNode;
  label: string;
  description: string;
  keywords: string[];
  action: (editor: ReturnType<typeof useEditorRef>) => void;
  /** If set, fires this AI action ID instead of a normal editor action. */
  aiActionId?: string;
  /** If true, opens VFS file picker instead of a normal editor action. */
  vfsAction?: boolean;
  /** If true, opens native file picker for attachment upload. */
  attachmentUpload?: boolean;
}

interface SlashMenuGroup {
  label: string;
  items: SlashMenuItem[];
}

const ICON_CLASS = "size-4 text-fg-muted";

const SLASH_MENU_GROUPS: SlashMenuGroup[] = [
  {
    label: "文本",
    items: [
      {
        icon: <Type className={ICON_CLASS} />,
        label: "段落",
        description: "普通文本块",
        keywords: ["text", "paragraph", "plain"],
        action: (editor) => {
          editor.tf.setNodes({ type: "p" } as Partial<TElement>);
        },
      },
      {
        icon: <Heading1 className={ICON_CLASS} />,
        label: "一级标题",
        description: "大标题",
        keywords: ["heading", "h1", "title", "large"],
        action: (editor) => {
          editor.tf.setNodes({ type: "h1" } as Partial<TElement>);
        },
      },
      {
        icon: <Heading2 className={ICON_CLASS} />,
        label: "二级标题",
        description: "中标题",
        keywords: ["heading", "h2", "subtitle", "medium"],
        action: (editor) => {
          editor.tf.setNodes({ type: "h2" } as Partial<TElement>);
        },
      },
      {
        icon: <Heading3 className={ICON_CLASS} />,
        label: "三级标题",
        description: "小标题",
        keywords: ["heading", "h3", "small"],
        action: (editor) => {
          editor.tf.setNodes({ type: "h3" } as Partial<TElement>);
        },
      },
      {
        icon: <Heading4 className={ICON_CLASS} />,
        label: "四级标题",
        description: "次级标题",
        keywords: ["heading", "h4"],
        action: (editor) => {
          editor.tf.setNodes({ type: "h4" } as Partial<TElement>);
        },
      },
      {
        icon: <Heading5 className={ICON_CLASS} />,
        label: "五级标题",
        description: "辅助标题",
        keywords: ["heading", "h5"],
        action: (editor) => {
          editor.tf.setNodes({ type: "h5" } as Partial<TElement>);
        },
      },
      {
        icon: <Heading6 className={ICON_CLASS} />,
        label: "六级标题",
        description: "最小标题",
        keywords: ["heading", "h6"],
        action: (editor) => {
          editor.tf.setNodes({ type: "h6" } as Partial<TElement>);
        },
      },
    ],
  },
  {
    label: "列表",
    items: [
      {
        icon: <List className={ICON_CLASS} />,
        label: "无序列表",
        description: "项目符号列表",
        keywords: ["list", "bullet", "unordered", "ul"],
        action: (editor) => {
          editor.tf.setNodes({
            type: "p",
            listStyleType: "disc",
            indent: 1,
          } as Partial<TElement>);
        },
      },
      {
        icon: <ListOrdered className={ICON_CLASS} />,
        label: "有序列表",
        description: "编号列表",
        keywords: ["list", "number", "ordered", "ol"],
        action: (editor) => {
          editor.tf.setNodes({
            type: "p",
            listStyleType: "decimal",
            indent: 1,
          } as Partial<TElement>);
        },
      },
      {
        icon: <CheckSquare className={ICON_CLASS} />,
        label: "待办列表",
        description: "可勾选的任务列表",
        keywords: ["todo", "task", "check", "checkbox"],
        action: (editor) => {
          editor.tf.setNodes({
            type: "p",
            listStyleType: "disc",
            indent: 1,
            checked: false,
          } as Partial<TElement>);
        },
      },
    ],
  },
  {
    label: "内容",
    items: [
      {
        icon: <Quote className={ICON_CLASS} />,
        label: "引用",
        description: "引用文本块",
        keywords: ["quote", "blockquote", "citation"],
        action: (editor) => {
          editor.tf.setNodes({ type: "blockquote" } as Partial<TElement>);
        },
      },
      {
        icon: <Code className={ICON_CLASS} />,
        label: "代码块",
        description: "带语法高亮的代码",
        keywords: ["code", "codeblock", "snippet", "programming"],
        action: (editor) => {
          editor.tf.setNodes({ type: "code_block" } as Partial<TElement>);
        },
      },
      {
        icon: <Minus className={ICON_CLASS} />,
        label: "分割线",
        description: "水平分割线",
        keywords: ["divider", "hr", "separator", "line", "horizontal"],
        action: (editor) => {
          editor.tf.setNodes({ type: "hr" } as Partial<TElement>);
        },
      },
    ],
  },
  {
    label: "块",
    items: [
      {
        icon: <Table className={ICON_CLASS} />,
        label: "表格",
        description: "插入表格",
        keywords: ["table", "grid", "spreadsheet"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "table",
            children: [
              {
                type: "tr",
                children: [
                  { type: "th", children: [{ text: "" }] },
                  { type: "th", children: [{ text: "" }] },
                  { type: "th", children: [{ text: "" }] },
                ],
              },
              {
                type: "tr",
                children: [
                  { type: "td", children: [{ text: "" }] },
                  { type: "td", children: [{ text: "" }] },
                  { type: "td", children: [{ text: "" }] },
                ],
              },
              {
                type: "tr",
                children: [
                  { type: "td", children: [{ text: "" }] },
                  { type: "td", children: [{ text: "" }] },
                  { type: "td", children: [{ text: "" }] },
                ],
              },
            ],
          } as unknown as TElement);
        },
      },
      {
        icon: <Info className={ICON_CLASS} />,
        label: "提示框",
        description: "高亮信息块",
        keywords: ["callout", "info", "note", "alert", "warning"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "callout",
            variant: "info",
            children: [{ text: "" }],
          } as unknown as TElement);
        },
      },
      {
        icon: <ChevronRight className={ICON_CLASS} />,
        label: "折叠块",
        description: "可展开/折叠的内容块",
        keywords: ["toggle", "collapse", "fold", "expand"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "toggle",
            children: [{ type: "p", children: [{ text: "" }] }],
          } as unknown as TElement);
        },
      },
      {
        icon: <TableOfContents className={ICON_CLASS} />,
        label: "目录",
        description: "自动生成的文档目录",
        keywords: ["toc", "table of contents", "outline", "navigation"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "toc",
            children: [{ text: "" }],
          } as unknown as TElement);
        },
      },
      {
        icon: <Image className={ICON_CLASS} />,
        label: "图片",
        description: "插入图片",
        keywords: ["image", "img", "photo", "picture"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "img",
            url: "",
            children: [{ text: "" }],
          } as unknown as TElement);
        },
      },
      {
        icon: <Video className={ICON_CLASS} />,
        label: "视频",
        description: "嵌入视频",
        keywords: ["video", "movie", "clip", "mp4"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "video",
            url: "",
            children: [{ text: "" }],
          } as unknown as TElement);
        },
      },
      {
        icon: <Music className={ICON_CLASS} />,
        label: "音频",
        description: "嵌入音频",
        keywords: ["audio", "music", "sound", "mp3"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "audio",
            url: "",
            children: [{ text: "" }],
          } as unknown as TElement);
        },
      },
      {
        icon: <FileIcon className={ICON_CLASS} />,
        label: "文件附件",
        description: "上传并嵌入文件",
        keywords: ["file", "attachment", "upload", "download"],
        attachmentUpload: true,
        action: () => {
          // Handled by attachmentUpload flag
        },
      },
      {
        icon: <ExternalLink className={ICON_CLASS} />,
        label: "媒体嵌入",
        description: "嵌入外部媒体链接",
        keywords: ["embed", "iframe", "external", "website", "url"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "media_embed",
            url: "",
            children: [{ text: "" }],
          } as unknown as TElement);
        },
      },
      {
        icon: <ExternalLink className={ICON_CLASS} />,
        label: "书签卡片",
        description: "链接预览卡片",
        keywords: ["bookmark", "link", "preview", "card", "url"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "bookmark",
            url: "",
            children: [{ text: "" }],
          } as unknown as TElement);
        },
      },
      {
        icon: <HardDrive className={ICON_CLASS} />,
        label: "文件引用",
        description: "从存储中引用文件",
        keywords: [
          "vfs",
          "file",
          "reference",
          "storage",
          "引用",
          "文件",
          "存储",
        ],
        vfsAction: true,
        action: () => {},
      },
      {
        icon: <Columns2 className={ICON_CLASS} />,
        label: "两栏布局",
        description: "左右两栏",
        keywords: ["column", "layout", "side", "split"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "column_group",
            children: [
              {
                type: "column",
                children: [{ type: "p", children: [{ text: "" }] }],
              },
              {
                type: "column",
                children: [{ type: "p", children: [{ text: "" }] }],
              },
            ],
          } as unknown as TElement);
        },
      },
      {
        icon: <Columns2 className={ICON_CLASS} />,
        label: "三栏布局",
        description: "三等分栏",
        keywords: ["column", "layout", "three", "triple"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "column_group",
            children: [
              {
                type: "column",
                children: [{ type: "p", children: [{ text: "" }] }],
              },
              {
                type: "column",
                children: [{ type: "p", children: [{ text: "" }] }],
              },
              {
                type: "column",
                children: [{ type: "p", children: [{ text: "" }] }],
              },
            ],
          } as unknown as TElement);
        },
      },
    ],
  },
  {
    label: "高级",
    items: [
      {
        icon: <Calendar className={ICON_CLASS} />,
        label: "日期",
        description: "插入日期选择器",
        keywords: ["date", "calendar", "time", "today"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "date",
            date: new Date().toISOString().split("T")[0],
            children: [{ text: "" }],
          } as unknown as TElement);
        },
      },
      {
        icon: <Sigma className={ICON_CLASS} />,
        label: "公式",
        description: "数学公式（LaTeX）",
        keywords: ["equation", "math", "latex", "formula"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "equation",
            texExpression: "",
            children: [{ text: "" }],
          } as unknown as TElement);
        },
      },
      {
        icon: <Superscript className={ICON_CLASS} />,
        label: "行内公式",
        description: "行内数学表达式",
        keywords: ["inline", "equation", "math", "formula"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "inline_equation",
            texExpression: "",
            children: [{ text: "" }],
          } as unknown as TElement);
        },
      },
      {
        icon: <GitBranch className={ICON_CLASS} />,
        label: "Mermaid 图表",
        description: "流程图、序列图、甘特图等",
        keywords: ["mermaid", "diagram", "flowchart", "图表", "流程图"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "mermaid",
            code: "graph TD\n  A[开始] --> B{判断}\n  B -->|是| C[结果1]\n  B -->|否| D[结果2]",
            children: [{ text: "" }],
          } as unknown as TElement);
        },
      },
      {
        icon: <AtSign className={ICON_CLASS} />,
        label: "@提及",
        description: "提及用户",
        keywords: ["mention", "at", "user", "person"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "mention_input",
            trigger: "@",
            children: [{ text: "" }],
          } as unknown as TElement);
        },
      },
      {
        icon: <Smile className={ICON_CLASS} />,
        label: "表情",
        description: "插入表情符号",
        keywords: ["emoji", "emoticon", "smiley", "face"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "emoji_input",
            trigger: ":",
            children: [{ text: "" }],
          } as unknown as TElement);
        },
      },
    ],
  },
  {
    label: "AI",
    items: [
      {
        icon: <Sparkles className={ICON_CLASS} />,
        label: "AI 写作助手",
        description: "打开 AI 面板",
        keywords: ["ai", "assistant", "写作", "助手"],
        aiActionId: "open-panel",
        action: () => {},
      },
      {
        icon: <Wand2 className={ICON_CLASS} />,
        label: "AI 润色优化",
        description: "优化选中文本",
        keywords: ["ai", "improve", "polish", "润色", "优化"],
        aiActionId: "improve",
        action: () => {},
      },
      {
        icon: <ArrowRight className={ICON_CLASS} />,
        label: "AI 续写",
        description: "从当前位置继续写作",
        keywords: ["ai", "continue", "续写", "继续"],
        aiActionId: "continue",
        action: () => {},
      },
      {
        icon: <Zap className={ICON_CLASS} />,
        label: "AI 总结",
        description: "生成文档摘要",
        keywords: ["ai", "summarize", "summary", "总结", "摘要"],
        aiActionId: "summarize",
        action: () => {},
      },
      {
        icon: <Languages className={ICON_CLASS} />,
        label: "AI 翻译",
        description: "翻译选中文本",
        keywords: ["ai", "translate", "翻译"],
        aiActionId: "translate-en",
        action: () => {},
      },
    ],
  },
];

function filterItems(
  groups: SlashMenuGroup[],
  query: string,
): SlashMenuGroup[] {
  if (!query) return groups;
  const lower = query.toLowerCase();
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(lower) ||
          item.keywords.some((k) => k.includes(lower)),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

function getAllItems(groups: SlashMenuGroup[]): SlashMenuItem[] {
  return groups.flatMap((g) => g.items);
}

export function SlashInputElement(props: PlateElementProps) {
  const { onAiAction, onInsertVfsFile, onAttachmentUpload } =
    useDocEditorContext();
  const editor = useEditorRef();
  const element = useElement();
  const inputRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredGroups = useMemo(
    () => filterItems(SLASH_MENU_GROUPS, query),
    [query],
  );
  const flatItems = useMemo(
    () => getAllItems(filteredGroups),
    [filteredGroups],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const removeInput = useCallback(() => {
    try {
      const path = editor.api.findPath(element);
      if (path) {
        editor.tf.removeNodes({ at: path });
      }
    } catch {
      // Silently fail — component will unmount naturally
    }
  }, [editor, element]);

  const dismissMenu = useCallback(() => {
    try {
      const path = editor.api.findPath(element);
      if (path) {
        const text = `/${inputRef.current?.textContent ?? ""}`;
        editor.tf.removeNodes({ at: path });
        editor.tf.insertText(text);
        return;
      }
    } catch {
      // Fall through to simple removal
    }
    // If findPath failed (editor lost focus), just remove the slash input
    removeInput();
  }, [editor, element, removeInput]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const menuEl = menuRef.current;
      const inputEl = inputRef.current;
      if (menuEl?.contains(e.target as Node)) return;
      if (inputEl?.contains(e.target as Node)) return;
      // On click outside, just remove the slash input (don't preserve "/")
      removeInput();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [removeInput]);

  const executeItem = useCallback(
    (item: SlashMenuItem) => {
      // Preserve the browser's trusted user gesture for native file pickers.
      // Unmounting the slash input first can make input.click() a no-op in
      // embedded browsers and automation-controlled WebViews.
      if (item.attachmentUpload && onAttachmentUpload) {
        onAttachmentUpload();
        removeInput();
        return;
      }

      removeInput();
      if (item.vfsAction && onInsertVfsFile) {
        onInsertVfsFile();
      } else if (item.aiActionId && onAiAction) {
        onAiAction(item.aiActionId);
      } else {
        item.action(editor);
      }
    },
    [editor, removeInput, onAiAction, onInsertVfsFile, onAttachmentUpload],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % Math.max(1, flatItems.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (i) => (i - 1 + flatItems.length) % Math.max(1, flatItems.length),
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          executeItem(flatItems[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        dismissMenu();
      } else if (e.key === "Backspace" && query === "") {
        e.preventDefault();
        removeInput();
      }
    },
    [flatItems, selectedIndex, executeItem, removeInput, dismissMenu, query],
  );

  const handleInput = useCallback(() => {
    const text = inputRef.current?.textContent ?? "";
    setQuery(text);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    const menuEl = menuRef.current;
    if (!menuEl) return;
    const selected = menuEl.querySelector("[data-selected='true']");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Menu position: render portal below the inline element
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // Don't dismiss if focus moved to the menu dropdown
      if (
        menuRef.current &&
        e.relatedTarget instanceof Node &&
        menuRef.current.contains(e.relatedTarget)
      ) {
        return;
      }
      removeInput();
    },
    [removeInput],
  );

  let itemIndex = -1;

  return (
    <PlateElement {...props} as="span" className="inline">
      <span className="text-[var(--accent)]">/</span>
      <span
        ref={inputRef}
        role="combobox"
        aria-expanded
        aria-haspopup="listbox"
        tabIndex={0}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="inline text-[var(--accent)] outline-none dark:text-[var(--accent)]"
        data-slate-editor={false}
      />
      {props.children}
      {menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-72 overflow-y-auto rounded-lg border border-base bg-surface-overlay py-1.5 text-fg-on-overlay shadow-md backdrop-blur-glass"
            style={{ top: menuPos.top, left: menuPos.left, maxHeight: 320 }}
          >
            {filteredGroups.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-fg-muted">
                无匹配结果
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.label}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-fg-muted uppercase">
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    itemIndex++;
                    const isSelected = itemIndex === selectedIndex;
                    const currentIndex = itemIndex;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        data-selected={isSelected}
                        className={`flex w-full cursor-pointer items-center gap-3 px-3 py-1.5 text-left text-sm transition-colors ${
                          isSelected
                            ? "bg-accent-subtle text-accent-text"
                            : "text-fg-secondary hover:bg-surface-overlay-hover"
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          executeItem(item);
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-base bg-surface-raised text-fg-on-raised">
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium">{item.label}</div>
                          <div className="truncate text-xs text-fg-muted">
                            {item.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>,
          document.body,
        )}
    </PlateElement>
  );
}
