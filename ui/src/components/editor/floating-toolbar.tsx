import { getCommentKey } from "@platejs/comment";
import { useFloatingToolbar, useFloatingToolbarState } from "@platejs/floating";
import { triggerFloatingLinkInsert } from "@platejs/link/react";
import {
  Bold,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Highlighter,
  Italic,
  Link,
  MessageSquare,
  Pilcrow,
  Quote,
  Sparkles,
  SquareCode,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
} from "lucide-react";
import type { TElement } from "platejs";
import { useEditorId, useEditorRef, useEventEditorValue } from "platejs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { randomUUID } from "../../lib/uuid";

function generateCommentKey(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

interface MarkButtonProps {
  markKey: string;
  icon: React.ReactNode;
  title: string;
}

function MarkButton({ markKey, icon, title }: MarkButtonProps) {
  const editor = useEditorRef();

  const isActive = (() => {
    const marks = editor.api.marks();
    return marks ? !!(marks as Record<string, unknown>)[markKey] : false;
  })();

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      editor.tf.toggleMark(markKey);
    },
    [editor, markKey],
  );

  return (
    <button
      type="button"
      title={title}
      onMouseDown={handleMouseDown}
      className={`flex size-8 items-center justify-center rounded transition-colors ${
        isActive
          ? "bg-[var(--accent-subtle)] text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent-text)]"
          : "text-fg-muted hover:bg-fill-tertiary"
      }`}
    >
      {icon}
    </button>
  );
}

function Separator() {
  return <div className="mx-0.5 h-5 w-px bg-border-base" />;
}

const ICON_SIZE = "size-4";

const BLOCK_TYPES = [
  { type: "p", label: "Paragraph", icon: Pilcrow },
  { type: "h1", label: "Heading 1", icon: Heading1 },
  { type: "h2", label: "Heading 2", icon: Heading2 },
  { type: "h3", label: "Heading 3", icon: Heading3 },
  { type: "h4", label: "Heading 4", icon: Heading4 },
  { type: "h5", label: "Heading 5", icon: Heading5 },
  { type: "h6", label: "Heading 6", icon: Heading6 },
  { type: "blockquote", label: "Quote", icon: Quote },
  { type: "code_block", label: "Code Block", icon: SquareCode },
] as const;

function TurnIntoDropdown() {
  const editor = useEditorRef();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const blockEntry = editor.api.block();
  const currentType = (blockEntry?.[0]?.type as string) ?? "p";
  const currentBlock = BLOCK_TYPES.find((b) => b.type === currentType);
  const CurrentIcon = currentBlock?.icon ?? Pilcrow;

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const handleSelect = useCallback(
    (type: string) => {
      editor.tf.setNodes({ type } as Partial<TElement>);
      setOpen(false);
    },
    [editor],
  );

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        title="Turn into…"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="flex h-8 items-center gap-0.5 rounded px-1.5 text-fg-muted transition-colors hover:bg-fill-tertiary"
      >
        <CurrentIcon className={ICON_SIZE} />
        <ChevronDown className="size-3" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-[9999] mt-1 min-w-[160px] rounded-lg border border-base bg-surface-overlay py-1 text-fg-on-overlay shadow-md backdrop-blur-glass">
          {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(type);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                currentType === type
                  ? "bg-[var(--accent-subtle)] text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent-text)]"
                  : "text-fg-secondary hover:bg-fill-tertiary "
              }`}
            >
              <Icon className={ICON_SIZE} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LinkButton() {
  const editor = useEditorRef();

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      triggerFloatingLinkInsert(editor, { focused: true });
    },
    [editor],
  );

  return (
    <button
      type="button"
      title="Link (⌘K)"
      onMouseDown={handleMouseDown}
      className="flex size-8 items-center justify-center rounded text-fg-muted transition-colors hover:bg-fill-tertiary"
    >
      <Link className={ICON_SIZE} />
    </button>
  );
}

function CommentButton({
  onAddComment,
}: {
  onAddComment?: (commentKey: string) => void;
}) {
  const editor = useEditorRef();

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const commentKey = generateCommentKey();
      editor.tf.addMark(getCommentKey(commentKey), true);
      editor.tf.addMark("comment", true);
      onAddComment?.(commentKey);
    },
    [editor, onAddComment],
  );

  return (
    <button
      type="button"
      title="评论"
      onMouseDown={handleMouseDown}
      className="flex size-8 items-center justify-center rounded text-fg-muted transition-colors hover:bg-fill-tertiary"
    >
      <MessageSquare className={ICON_SIZE} />
    </button>
  );
}

function AiButton({ onOpenAi }: { onOpenAi?: () => void }) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onOpenAi?.();
    },
    [onOpenAi],
  );

  return (
    <button
      type="button"
      title="AI 助手"
      onMouseDown={handleMouseDown}
      className="flex size-8 items-center justify-center rounded text-purple-500 transition-colors hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/30"
    >
      <Sparkles className={ICON_SIZE} />
    </button>
  );
}

export function FloatingToolbar({
  onAddComment,
  onOpenAi,
}: {
  onAddComment?: (commentKey: string) => void;
  onOpenAi?: () => void;
} = {}) {
  const editorId = useEditorId();
  const focusedEditorId = useEventEditorValue("focus");

  const state = useFloatingToolbarState({
    editorId,
    focusedEditorId,
  });

  const { ref, props, hidden } = useFloatingToolbar(state);

  if (hidden) return null;

  return createPortal(
    <div
      ref={ref}
      className="z-[9999] flex items-center gap-0.5 rounded-lg border border-base bg-surface-overlay px-1 py-0.5 text-fg-on-overlay shadow-md backdrop-blur-glass"
      {...props}
    >
      <TurnIntoDropdown />
      <Separator />
      <MarkButton
        markKey="bold"
        icon={<Bold className={ICON_SIZE} />}
        title="Bold (⌘B)"
      />
      <MarkButton
        markKey="italic"
        icon={<Italic className={ICON_SIZE} />}
        title="Italic (⌘I)"
      />
      <MarkButton
        markKey="underline"
        icon={<Underline className={ICON_SIZE} />}
        title="Underline (⌘U)"
      />
      <MarkButton
        markKey="strikethrough"
        icon={<Strikethrough className={ICON_SIZE} />}
        title="Strikethrough"
      />
      <Separator />
      <MarkButton
        markKey="code"
        icon={<Code className={ICON_SIZE} />}
        title="Inline Code (⌘E)"
      />
      <MarkButton
        markKey="highlight"
        icon={<Highlighter className={ICON_SIZE} />}
        title="Highlight"
      />
      <MarkButton
        markKey="superscript"
        icon={<Superscript className={ICON_SIZE} />}
        title="Superscript"
      />
      <MarkButton
        markKey="subscript"
        icon={<Subscript className={ICON_SIZE} />}
        title="Subscript"
      />
      <Separator />
      <LinkButton />
      <CommentButton onAddComment={onAddComment} />
      <AiButton onOpenAi={onOpenAi} />
    </div>,
    document.body,
  );
}
