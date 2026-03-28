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
}

interface SlashMenuGroup {
  label: string;
  items: SlashMenuItem[];
}

const ICON_CLASS = "size-4 text-zinc-500 dark:text-zinc-400";

const SLASH_MENU_GROUPS: SlashMenuGroup[] = [
  {
    label: "Text",
    items: [
      {
        icon: <Type className={ICON_CLASS} />,
        label: "Paragraph",
        description: "Plain text block",
        keywords: ["text", "paragraph", "plain"],
        action: (editor) => {
          editor.tf.setNodes({ type: "p" } as Partial<TElement>);
        },
      },
      {
        icon: <Heading1 className={ICON_CLASS} />,
        label: "Heading 1",
        description: "Large section heading",
        keywords: ["heading", "h1", "title", "large"],
        action: (editor) => {
          editor.tf.setNodes({ type: "h1" } as Partial<TElement>);
        },
      },
      {
        icon: <Heading2 className={ICON_CLASS} />,
        label: "Heading 2",
        description: "Medium section heading",
        keywords: ["heading", "h2", "subtitle", "medium"],
        action: (editor) => {
          editor.tf.setNodes({ type: "h2" } as Partial<TElement>);
        },
      },
      {
        icon: <Heading3 className={ICON_CLASS} />,
        label: "Heading 3",
        description: "Small section heading",
        keywords: ["heading", "h3", "small"],
        action: (editor) => {
          editor.tf.setNodes({ type: "h3" } as Partial<TElement>);
        },
      },
      {
        icon: <Heading4 className={ICON_CLASS} />,
        label: "Heading 4",
        description: "Sub-section heading",
        keywords: ["heading", "h4"],
        action: (editor) => {
          editor.tf.setNodes({ type: "h4" } as Partial<TElement>);
        },
      },
      {
        icon: <Heading5 className={ICON_CLASS} />,
        label: "Heading 5",
        description: "Minor heading",
        keywords: ["heading", "h5"],
        action: (editor) => {
          editor.tf.setNodes({ type: "h5" } as Partial<TElement>);
        },
      },
      {
        icon: <Heading6 className={ICON_CLASS} />,
        label: "Heading 6",
        description: "Smallest heading",
        keywords: ["heading", "h6"],
        action: (editor) => {
          editor.tf.setNodes({ type: "h6" } as Partial<TElement>);
        },
      },
    ],
  },
  {
    label: "Lists",
    items: [
      {
        icon: <List className={ICON_CLASS} />,
        label: "Bulleted List",
        description: "Unordered list with bullets",
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
        label: "Numbered List",
        description: "Ordered list with numbers",
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
        label: "To-do List",
        description: "Checklist with checkboxes",
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
    label: "Content",
    items: [
      {
        icon: <Quote className={ICON_CLASS} />,
        label: "Quote",
        description: "Highlighted quote block",
        keywords: ["quote", "blockquote", "citation"],
        action: (editor) => {
          editor.tf.setNodes({ type: "blockquote" } as Partial<TElement>);
        },
      },
      {
        icon: <Code className={ICON_CLASS} />,
        label: "Code Block",
        description: "Code with syntax highlighting",
        keywords: ["code", "codeblock", "snippet", "programming"],
        action: (editor) => {
          editor.tf.setNodes({ type: "code_block" } as Partial<TElement>);
        },
      },
      {
        icon: <Minus className={ICON_CLASS} />,
        label: "Divider",
        description: "Horizontal divider line",
        keywords: ["divider", "hr", "separator", "line", "horizontal"],
        action: (editor) => {
          editor.tf.setNodes({ type: "hr" } as Partial<TElement>);
        },
      },
    ],
  },
  {
    label: "Blocks",
    items: [
      {
        icon: <Table className={ICON_CLASS} />,
        label: "Table",
        description: "Insert a table",
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
        label: "Callout",
        description: "Highlighted info block",
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
        label: "Toggle",
        description: "Collapsible toggle block",
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
        label: "Table of Contents",
        description: "Auto-generated from headings",
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
        label: "Image",
        description: "Insert an image",
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
        label: "Video",
        description: "Embed a video",
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
        label: "Audio",
        description: "Embed an audio file",
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
        label: "File",
        description: "Attach a file",
        keywords: ["file", "attachment", "upload", "download"],
        action: (editor) => {
          editor.tf.insertNodes({
            type: "file",
            url: "",
            name: "Untitled",
            children: [{ text: "" }],
          } as unknown as TElement);
        },
      },
      {
        icon: <ExternalLink className={ICON_CLASS} />,
        label: "Embed",
        description: "Embed external content",
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
        label: "Bookmark",
        description: "Link preview card",
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
        icon: <Columns2 className={ICON_CLASS} />,
        label: "2 Columns",
        description: "Two column layout",
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
        label: "3 Columns",
        description: "Three column layout",
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
    label: "Advanced",
    items: [
      {
        icon: <Calendar className={ICON_CLASS} />,
        label: "Date",
        description: "Insert current date",
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
        label: "Equation",
        description: "LaTeX math equation block",
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
        label: "Inline Equation",
        description: "Inline LaTeX formula",
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
        label: "Mention",
        description: "Mention a user with @",
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
        label: "Emoji",
        description: "Insert an emoji",
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
  const { onAiAction } = useDocEditorContext();
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: query changes should reset selection index
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const removeInput = useCallback(() => {
    const path = editor.api.findPath(element);
    if (path) {
      editor.tf.removeNodes({ at: path });
    }
  }, [editor, element]);

  const executeItem = useCallback(
    (item: SlashMenuItem) => {
      removeInput();
      if (item.aiActionId && onAiAction) {
        onAiAction(item.aiActionId);
      } else {
        item.action(editor);
      }
    },
    [editor, removeInput, onAiAction],
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
        removeInput();
      } else if (e.key === "Backspace" && query === "") {
        e.preventDefault();
        removeInput();
      }
    },
    [flatItems, selectedIndex, executeItem, removeInput, query],
  );

  const handleInput = useCallback(() => {
    const text = inputRef.current?.textContent ?? "";
    setQuery(text);
  }, []);

  // Scroll selected item into view
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedIndex triggers the scroll
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

  let itemIndex = -1;

  return (
    <PlateElement {...props} as="span" className="inline">
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
        className="inline text-blue-600 outline-none dark:text-blue-400"
        data-slate-editor={false}
      />
      {props.children}
      {menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
            style={{ top: menuPos.top, left: menuPos.left, maxHeight: 320 }}
          >
            {filteredGroups.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-zinc-400">
                No results
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.label}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-zinc-400 uppercase dark:text-zinc-500">
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
                        className={`flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm transition-colors ${
                          isSelected
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          executeItem(item);
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-700">
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium">{item.label}</div>
                          <div className="truncate text-xs text-zinc-400 dark:text-zinc-500">
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
