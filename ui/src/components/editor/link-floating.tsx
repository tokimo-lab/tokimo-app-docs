import { unwrapLink } from "@platejs/link";
import {
  FloatingLinkUrlInput,
  submitFloatingLink,
  triggerFloatingLinkEdit,
  useFloatingLinkEdit,
  useFloatingLinkEditState,
  useFloatingLinkEnter,
  useFloatingLinkEscape,
  useFloatingLinkInsert,
  useFloatingLinkInsertState,
} from "@platejs/link/react";
import { ExternalLink, Link2Off, Pencil } from "lucide-react";
import type { TLinkElement } from "platejs";
import { useEditorRef } from "platejs/react";
import { useCallback } from "react";
import { createPortal } from "react-dom";

const INPUT_CLASS =
  "h-8 w-60 rounded border border-border-base bg-transparent px-2 text-sm text-fg-primary placeholder:text-fg-muted focus:border-[var(--accent)] focus:outline-none ";

const BTN_CLASS =
  "flex size-8 items-center justify-center rounded text-fg-muted transition-colors hover:bg-fill-tertiary";

const PANEL_CLASS =
  "z-[9999] flex items-center gap-1 rounded-lg border border-border-base bg-surface-elevated p-1 shadow-lg ";

function LinkInsertPanel() {
  const state = useFloatingLinkInsertState();
  useFloatingLinkInsert(state);
  useFloatingLinkEnter();
  useFloatingLinkEscape();

  const editor = useEditorRef();
  const { floating, isOpen } = state;

  const handleSave = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      submitFloatingLink(editor);
    },
    [editor],
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={floating.refs.setFloating}
      style={floating.style}
      className={PANEL_CLASS}
    >
      <FloatingLinkUrlInput
        className={INPUT_CLASS}
        placeholder="Paste or type a link…"
      />
      <button
        type="button"
        onMouseDown={handleSave}
        className={`${BTN_CLASS} text-[var(--accent)]`}
        title="Save"
      >
        <svg
          className="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}

function LinkEditPanel() {
  const state = useFloatingLinkEditState();
  useFloatingLinkEdit(state);

  const editor = useEditorRef();
  const { floating, isOpen, isEditing } = state;

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      triggerFloatingLinkEdit(editor);
    },
    [editor],
  );

  const handleUnlink = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      unwrapLink(editor);
    },
    [editor],
  );

  const handleSave = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      submitFloatingLink(editor);
    },
    [editor],
  );

  if (!isOpen) return null;

  // Edit mode: show URL input + save
  if (isEditing) {
    return createPortal(
      <div
        ref={floating.refs.setFloating}
        style={floating.style}
        className={PANEL_CLASS}
      >
        <FloatingLinkUrlInput className={INPUT_CLASS} placeholder="Edit URL…" />
        <button
          type="button"
          onMouseDown={handleSave}
          className={`${BTN_CLASS} text-[var(--accent)]`}
          title="Save"
        >
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>,
      document.body,
    );
  }

  // View mode: show URL preview + edit/open/unlink
  const linkEntry = editor.api.node<TLinkElement>({ match: { type: "a" } });
  const url = linkEntry?.[0]?.url ?? "";
  const displayUrl = url.length > 32 ? `${url.slice(0, 32)}…` : url;

  return createPortal(
    <div
      ref={floating.refs.setFloating}
      style={floating.style}
      className={PANEL_CLASS}
    >
      <span
        className="max-w-[200px] truncate px-2 text-sm text-fg-muted"
        title={url}
      >
        {displayUrl}
      </span>
      <button
        type="button"
        onMouseDown={handleEdit}
        className={BTN_CLASS}
        title="Edit link"
      >
        <Pencil className="size-4" />
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={BTN_CLASS}
        title="Open in new tab"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ExternalLink className="size-4" />
      </a>
      <button
        type="button"
        onMouseDown={handleUnlink}
        className={BTN_CLASS}
        title="Remove link"
      >
        <Link2Off className="size-4" />
      </button>
    </div>,
    document.body,
  );
}

export function LinkFloatingToolbar() {
  return (
    <>
      <LinkInsertPanel />
      <LinkEditPanel />
    </>
  );
}
