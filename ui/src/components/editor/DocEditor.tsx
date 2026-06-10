import { AutoformatPlugin } from "@platejs/autoformat";
import {
  BlockquotePlugin,
  BoldPlugin,
  CodePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  H4Plugin,
  H5Plugin,
  H6Plugin,
  HighlightPlugin,
  HorizontalRulePlugin,
  ItalicPlugin,
  KbdPlugin,
  StrikethroughPlugin,
  SubscriptPlugin,
  SuperscriptPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react";
import { CalloutPlugin } from "@platejs/callout/react";
import {
  CodeBlockPlugin,
  CodeLinePlugin,
  CodeSyntaxPlugin,
} from "@platejs/code-block/react";
import { CommentPlugin } from "@platejs/comment/react";
import { DatePlugin } from "@platejs/date/react";
import { DndPlugin } from "@platejs/dnd";
import { DocxPlugin } from "@platejs/docx";
import { EmojiInputPlugin, EmojiPlugin } from "@platejs/emoji/react";
import { IndentPlugin } from "@platejs/indent/react";
import { ColumnItemPlugin, ColumnPlugin } from "@platejs/layout/react";
import { LinkPlugin } from "@platejs/link/react";
import { ListPlugin } from "@platejs/list/react";
import { EquationPlugin, InlineEquationPlugin } from "@platejs/math/react";
import {
  AudioPlugin,
  FilePlugin,
  ImagePlugin,
  MediaEmbedPlugin,
  VideoPlugin,
} from "@platejs/media/react";
import { MentionInputPlugin, MentionPlugin } from "@platejs/mention/react";
import { SlashInputPlugin, SlashPlugin } from "@platejs/slash-command/react";
import {
  TableCellHeaderPlugin,
  TableCellPlugin,
  TablePlugin,
  TableRowPlugin,
} from "@platejs/table/react";
import { TocPlugin } from "@platejs/toc/react";
import { TogglePlugin } from "@platejs/toggle/react";
import { BaseYjsPlugin } from "@platejs/yjs";
import "katex/dist/katex.min.css";
import { common, createLowlight } from "lowlight";
import type { Value } from "platejs";
import { createSlatePlugin } from "platejs";
import {
  ParagraphPlugin,
  Plate,
  PlateContent,
  usePlateEditor,
} from "platejs/react";
import type { MutableRefObject } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { docAttachmentApi } from "@/generated/rust-api/docs/attachment";
import { PROVIDER_TYPE, type TokimoWsProviderOptions } from "./collab-provider";
import { AttachmentElement } from "./elements/attachment-element";
import { BlockquoteElement } from "./elements/blockquote-element";
import { BookmarkElement } from "./elements/bookmark-element";
import { CalloutElement } from "./elements/callout-element";
import { CodeBlockElement } from "./elements/code-block-element";
import { CodeLineElement } from "./elements/code-line-element";
import { CodeSyntaxLeaf } from "./elements/code-syntax-leaf";
import { ColumnElement, ColumnGroupElement } from "./elements/column-element";
import { CommentLeaf } from "./elements/comment-leaf";
import { DateElement } from "./elements/date-element";
import { EmojiInputElement } from "./elements/emoji-input-element";
import {
  EquationElement,
  InlineEquationElement,
} from "./elements/equation-element";
import { HeadingElement } from "./elements/heading-element";
import { HrElement } from "./elements/hr-element";
import { ImageElement } from "./elements/image-element";
import { LinkElement } from "./elements/link-element";
import {
  AudioElement,
  FileElement,
  MediaEmbedElement,
  VideoElement,
} from "./elements/media-elements";
import { MentionElement } from "./elements/mention-element";
import { MentionInputElement } from "./elements/mention-input-element";
import { MermaidElement } from "./elements/mermaid-element";
import { ParagraphElement } from "./elements/paragraph-element";
import {
  TableCellElement,
  TableElement,
  TableHeaderCellElement,
  TableRowElement,
} from "./elements/table-element";
import { TocElement } from "./elements/toc-element";
import { ToggleElement } from "./elements/toggle-element";
import { VfsFileElement } from "./elements/vfs-file-element";
import { FloatingToolbar } from "./floating-toolbar";
import { LinkFloatingToolbar } from "./link-floating";
import { RemoteCursorOverlay } from "./remote-cursor-overlay";
import { SlashInputElement } from "./slash-menu";

export type DocEditorHandle = ReturnType<typeof usePlateEditor>;

/** Context for passing AI actions and VFS picker to slash menu and other editor children. */
interface DocEditorCtx {
  onAiAction?: (actionId: string) => void;
  onOpenAi?: () => void;
  onInsertVfsFile?: () => void;
  onAttachmentUpload?: () => void;
  /** Doc node ID — consumed by child elements (e.g. attachment-element) that
   * need to fall back to REST API when Yjs state is stale (e.g. after a VFS
   * shell write repopulated docs_node_attachments rows). */
  spaceId?: string;
  relPath?: string;
}
const DocEditorContext = createContext<DocEditorCtx>({});
export function useDocEditorContext() {
  return useContext(DocEditorContext);
}

export interface DocEditorProps {
  value: Value | null;
  onChange: (value: Value) => void;
  readOnly?: boolean;
  placeholder?: string;
  editorRef?: MutableRefObject<DocEditorHandle | null>;
  onAddComment?: (commentKey: string) => void;
  onOpenAi?: () => void;
  onAiAction?: (actionId: string) => void;
  onInsertVfsFile?: () => void;
  onAttachmentUpload?: () => void;
  /** Doc node ID — when provided, enables real-time collaborative editing. */
  spaceId?: string;
  relPath?: string;
  /** User display name for remote cursor labels. */
  userName?: string;
}

const EMPTY_VALUE: Value = [{ type: "p", children: [{ text: "" }] }];

const autoformatRules = [
  { mode: "block" as const, match: "# ", type: "h1" },
  { mode: "block" as const, match: "## ", type: "h2" },
  { mode: "block" as const, match: "### ", type: "h3" },
  { mode: "block" as const, match: "#### ", type: "h4" },
  { mode: "block" as const, match: "##### ", type: "h5" },
  { mode: "block" as const, match: "###### ", type: "h6" },
  { mode: "block" as const, match: "> ", type: "blockquote" },
  { mode: "block" as const, match: "--- ", type: "hr" },
  { mode: "mark" as const, match: { start: "**", end: "**" }, type: "bold" },
  { mode: "mark" as const, match: { start: "__", end: "__" }, type: "bold" },
  { mode: "mark" as const, match: { start: "*", end: "*" }, type: "italic" },
  { mode: "mark" as const, match: { start: "_", end: "_" }, type: "italic" },
  {
    mode: "mark" as const,
    match: { start: "~~", end: "~~" },
    type: "strikethrough",
  },
  { mode: "mark" as const, match: { start: "`", end: "`" }, type: "code" },
  {
    mode: "mark" as const,
    match: { start: "==", end: "==" },
    type: "highlight",
  },
];

/** Ensure the document always ends with a non-void paragraph so the user can place the cursor after void blocks. */
const TrailingBlockPlugin = createSlatePlugin({
  key: "trailingBlock",
  extendEditor: ({ editor }) => {
    const origNormalize = editor.normalizeNode;
    editor.normalizeNode = ((entry: [unknown, number[]]) => {
      const [, path] = entry;
      if (path.length === 0 && editor.children.length > 0) {
        const lastChild = editor.children[editor.children.length - 1];
        const lastType = (lastChild as Record<string, unknown>)?.type as
          | string
          | undefined;
        const isVoid = lastType ? editor.api.isVoid(lastChild) : false;
        const needsTrailing =
          isVoid ||
          lastType === "hr" ||
          lastType === "toc" ||
          lastType === "column_group";
        if (needsTrailing) {
          editor.tf.insertNodes(
            { type: "p", children: [{ text: "" }] } as never,
            { at: [editor.children.length] },
          );
          return;
        }
      }
      (origNormalize as (entry: [unknown, number[]]) => void)(entry);
    }) as typeof editor.normalizeNode;
    return editor;
  },
});

const plugins = [
  // Block elements
  ParagraphPlugin.withComponent(ParagraphElement),
  H1Plugin.withComponent(HeadingElement),
  H2Plugin.withComponent(HeadingElement),
  H3Plugin.withComponent(HeadingElement),
  H4Plugin.withComponent(HeadingElement),
  H5Plugin.withComponent(HeadingElement),
  H6Plugin.withComponent(HeadingElement),
  BlockquotePlugin.withComponent(BlockquoteElement),
  HorizontalRulePlugin.withComponent(HrElement),
  CodeBlockPlugin.configure({
    options: { lowlight: createLowlight(common) },
  }).withComponent(CodeBlockElement),
  CodeLinePlugin.withComponent(CodeLineElement),
  CodeSyntaxPlugin.withComponent(CodeSyntaxLeaf),
  LinkPlugin.withComponent(LinkElement),

  // Table
  TablePlugin.withComponent(TableElement),
  TableRowPlugin.withComponent(TableRowElement),
  TableCellPlugin.withComponent(TableCellElement),
  TableCellHeaderPlugin.withComponent(TableHeaderCellElement),

  // Callout
  CalloutPlugin.withComponent(CalloutElement),

  // Toggle (collapsible)
  TogglePlugin.withComponent(ToggleElement),

  // Table of Contents
  TocPlugin.withComponent(TocElement),

  // Multi-column layout
  ColumnPlugin.withComponent(ColumnGroupElement),
  ColumnItemPlugin.withComponent(ColumnElement),

  // Image
  ImagePlugin.withComponent(ImageElement),

  // Video
  VideoPlugin.withComponent(VideoElement),

  // Audio
  AudioPlugin.withComponent(AudioElement),

  // File attachment
  FilePlugin.withComponent(FileElement),

  // Media embed (iframe)
  MediaEmbedPlugin.withComponent(MediaEmbedElement),

  // Date
  DatePlugin.withComponent(DateElement),

  // Equations
  EquationPlugin.withComponent(EquationElement),
  InlineEquationPlugin.withComponent(InlineEquationElement),

  // Mermaid diagrams
  createSlatePlugin({
    key: "mermaid",
    node: { isElement: true, isVoid: true },
  }).withComponent(MermaidElement),

  // Bookmark (link preview card)
  createSlatePlugin({
    key: "bookmark",
    node: { isElement: true, isVoid: true },
  }).withComponent(BookmarkElement),

  // VFS file reference
  createSlatePlugin({
    key: "vfs_file",
    node: { isElement: true, isVoid: true },
  }).withComponent(VfsFileElement),

  // Attachment (uploaded file with preview)
  createSlatePlugin({
    key: "attachment",
    node: { isElement: true, isVoid: true },
  }).withComponent(AttachmentElement),

  // Mention (@)
  MentionPlugin.configure({
    options: { trigger: "@", insertSpaceAfterMention: true },
  }).withComponent(MentionElement),
  MentionInputPlugin.withComponent(MentionInputElement),

  // Emoji (:)
  EmojiPlugin.configure({
    options: { trigger: ":" },
  }),
  EmojiInputPlugin.withComponent(EmojiInputElement),

  // Comments
  CommentPlugin.withComponent(CommentLeaf),

  // DOCX paste support (cleans Word HTML on paste)
  DocxPlugin,

  // Marks (no withComponent — built-in rendering)
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  CodePlugin,
  HighlightPlugin,
  SuperscriptPlugin,
  SubscriptPlugin,
  KbdPlugin,

  // Lists (indent-based)
  ListPlugin,
  IndentPlugin.configure({ options: { offset: 24, unit: "px" } }),

  // Slash command
  SlashPlugin,
  SlashInputPlugin.withComponent(SlashInputElement),

  // Autoformat
  AutoformatPlugin.configure({ options: { rules: autoformatRules } }),

  // Drag & drop block reordering
  DndPlugin,

  // Trailing block — always end with a paragraph after void elements
  TrailingBlockPlugin,
];

/** Recursively collect all attachment IDs from a Plate value tree. */
function collectAttachmentIds(nodes: Value): Set<string> {
  const ids = new Set<string>();
  const walk = (list: readonly Record<string, unknown>[]) => {
    for (const node of list) {
      if (node.type === "attachment" && typeof node.attachmentId === "string") {
        ids.add(node.attachmentId);
      }
      if (Array.isArray(node.children)) {
        walk(node.children as Record<string, unknown>[]);
      }
    }
  };
  walk(nodes as unknown as Record<string, unknown>[]);
  return ids;
}

export function DocEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = "输入 '/' 插入内容…",
  editorRef,
  onAddComment,
  onOpenAi,
  onAiAction,
  onInsertVfsFile,
  onAttachmentUpload,
  spaceId,
  relPath,
  userName,
}: DocEditorProps) {
  const initialValue = useMemo(
    () => (Array.isArray(value) && value.length > 0 ? value : EMPTY_VALUE),
    [value],
  );
  const collabEnabled = !!spaceId && !!relPath && !readOnly;

  // Stable random color for this tab instance (different across multi-tab)
  const tabColor = useMemo(() => randomCursorColor(), []);

  // Build plugin list — add Yjs collab plugin when nodeId is provided
  const allPlugins = useMemo(() => {
    if (!collabEnabled || !spaceId || !relPath) return plugins;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port =
      window.location.port === "5173" ? "5678" : window.location.port;
    const wsUrl = `${proto}//${host}:${port}/api/apps/docs/spaces/${encodeURIComponent(spaceId)}/collab?relPath=${encodeURIComponent(relPath)}`;

    return [
      ...plugins,
      BaseYjsPlugin.configure({
        options: {
          cursors: {
            data: {
              color: tabColor,
              name: userName ?? "Anonymous",
            },
          },
          providers: [
            {
              options: {
                roomName: `${spaceId}:${relPath}`,
                url: wsUrl,
              } satisfies TokimoWsProviderOptions,
              type: PROVIDER_TYPE,
            } as never,
          ],
        },
      }),
    ];
  }, [collabEnabled, spaceId, relPath, userName, tabColor]);

  const editor = usePlateEditor(
    { plugins: allPlugins, value: initialValue },
    collabEnabled ? [`${spaceId}:${relPath}`] : [initialValue],
  );

  // Initialize Yjs collab plugin — must be called explicitly after editor creation.
  // Patches editor.connect() to be idempotent (Strict Mode calls init() twice).
  const yjsInitRef = useRef(false);
  useEffect(() => {
    if (!collabEnabled || !editor) return;

    // biome-ignore lint/suspicious/noExplicitAny: BaseYjsPlugin adds .api.yjs at runtime
    const api = (editor as any).api;
    const yjs = api?.yjs as
      | {
          init: (opts?: { value?: Value }) => Promise<void>;
          destroy: () => void;
        }
      | undefined;
    if (!yjs) return;

    // React Strict Mode fires effect → cleanup → effect. The first async
    // init() may still call editor.connect() after cleanup has run, then
    // the second init() also tries to connect → "already connected" error.
    // Patch connect() to be idempotent so both calls succeed silently.
    const ed = editor as unknown as {
      connect: () => void;
      disconnect: () => void;
    };
    if (!yjsInitRef.current) {
      const origConnect = ed.connect;
      ed.connect = () => {
        try {
          origConnect.call(ed);
        } catch {
          // "already connected" — safe to ignore
        }
      };
      yjsInitRef.current = true;
    }

    yjs.init({ value: initialValue }).catch((err: unknown) => {
      console.warn("[collab] yjs.init:", err);
    });

    return () => {
      try {
        yjs.destroy();
      } catch {
        // Cleanup may fail if init didn't complete
      }
    };
  }, [collabEnabled, editor, initialValue]);

  useEffect(() => {
    if (editorRef) editorRef.current = editor;
  }, [editor, editorRef]);

  // Track previous attachment IDs to detect removals (soft-delete) and restores (undo)
  const prevAttachmentIdsRef = useRef<Set<string>>(
    collectAttachmentIds(initialValue),
  );

  const handleValueChange = useCallback(
    (newValue: Value) => {
      onChange(newValue);

      if (readOnly) return;

      const newIds = collectAttachmentIds(newValue);
      const prevIds = prevAttachmentIdsRef.current;

      // Soft-delete removed attachments
      for (const id of prevIds) {
        if (!newIds.has(id) && spaceId) {
          docAttachmentApi.delete.mutate({ spaceId, id }).catch((err) => {
            console.warn("[docs] Failed to soft-delete attachment:", err);
          });
        }
      }

      // Restore re-added attachments (e.g. undo after delete)
      for (const id of newIds) {
        if (!prevIds.has(id) && spaceId) {
          docAttachmentApi.restore.mutate({ spaceId, id }).catch(() => {
            // Ignore — may be a newly uploaded attachment (no soft-delete record)
          });
        }
      }

      prevAttachmentIdsRef.current = newIds;
    },
    [onChange, readOnly, spaceId],
  );

  const editorCtx = useMemo(
    () => ({
      onAiAction,
      onOpenAi,
      onInsertVfsFile,
      onAttachmentUpload,
      spaceId,
      relPath,
    }),
    [
      onAiAction,
      onOpenAi,
      onInsertVfsFile,
      onAttachmentUpload,
      spaceId,
      relPath,
    ],
  );

  if (!editor) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-fg-muted">
        Loading editor…
      </div>
    );
  }

  return (
    <DocEditorContext.Provider value={editorCtx}>
      <DndProvider backend={HTML5Backend}>
        <Plate
          editor={editor}
          onValueChange={({ value: newValue }) => handleValueChange(newValue)}
          readOnly={readOnly}
        >
          <EditorContent
            collabEnabled={collabEnabled}
            placeholder={placeholder}
            localUserName={userName}
          />
          {!readOnly && (
            <FloatingToolbar onAddComment={onAddComment} onOpenAi={onOpenAi} />
          )}
          {!readOnly && <LinkFloatingToolbar />}
        </Plate>
      </DndProvider>
    </DocEditorContext.Provider>
  );
}

/** A palette of visually distinct cursor colors. Each tab picks one at random. */
const CURSOR_COLORS = [
  "#F44336",
  "#E91E63",
  "#9C27B0",
  "#673AB7",
  "#3F51B5",
  "#2196F3",
  "#03A9F4",
  "#00BCD4",
  "#009688",
  "#4CAF50",
  "#8BC34A",
  "#FF9800",
  "#FF5722",
  "#795548",
  "#607D8B",
];

function randomCursorColor(): string {
  return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
}

/** Inner editor content — conditionally wrapped with remote cursor overlay. */
function EditorContent({
  collabEnabled,
  placeholder,
  localUserName,
}: {
  collabEnabled: boolean;
  placeholder?: string;
  localUserName?: string;
}) {
  const content = (
    <div className="relative w-full pl-[18px] pr-3 py-8">
      <PlateContent
        className="doc-editor-content min-h-[200px] outline-none [&_[data-slate-placeholder]]:!text-fg-muted [&_[data-slate-placeholder]]:!opacity-100 dark:[&_[data-slate-placeholder]]:!text-fg-muted"
        placeholder={placeholder}
      />
    </div>
  );

  if (!collabEnabled) return content;

  return (
    <RemoteCursorOverlay localUserName={localUserName}>
      {content}
    </RemoteCursorOverlay>
  );
}
