import { useFloatingToolbar, useFloatingToolbarState } from "@platejs/floating";
import {
  Bold,
  Code,
  Highlighter,
  Italic,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useEditorId, useEditorRef, useEventEditorValue } from "platejs/react";
import { useCallback } from "react";
import { createPortal } from "react-dom";

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
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
      }`}
    >
      {icon}
    </button>
  );
}

const ICON_SIZE = "size-4";

export function FloatingToolbar() {
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
      className="z-[9999] flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-white px-1 py-0.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
      {...props}
    >
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
      <div className="mx-0.5 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
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
    </div>,
    document.body,
  );
}
