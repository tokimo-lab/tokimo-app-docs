import { ExternalLink } from "lucide-react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useEditorRef, useElement } from "platejs/react";
import { useCallback, useState } from "react";

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * BookmarkElement — Displays a URL as a styled link card.
 *
 * Stored data: { type: "bookmark", url, title?, description?, children }
 * The user can click to edit the URL/title inline.
 */
export function BookmarkElement(props: PlateElementProps) {
  const editor = useEditorRef();
  const element = useElement();
  const el = element as Record<string, unknown>;
  const url = (el.url as string) || "";
  const title = (el.title as string) || "";
  const description = (el.description as string) || "";
  const hostname = url ? safeHostname(url) : "";

  const [editing, setEditing] = useState(!url);
  const [draft, setDraft] = useState(url);

  const handleSave = useCallback(() => {
    if (draft.trim()) {
      const path = editor.api.findPath(element);
      if (path) {
        editor.tf.setNodes({ url: draft.trim() } as never, { at: path });
      }
    }
    setEditing(false);
  }, [draft, element, editor]);

  if (editing) {
    return (
      <PlateElement className="my-3" {...props}>
        <div
          contentEditable={false}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/60"
        >
          <ExternalLink size={16} className="shrink-0 text-fg-muted" />
          <input
            type="url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            placeholder="Enter URL..."
            className="flex-1 border-none bg-transparent text-sm text-fg-secondary outline-none placeholder:text-fg-muted  "
            // biome-ignore lint/a11y/noAutofocus: intentional focus when entering bookmark URL
            autoFocus
          />
        </div>
        {props.children}
      </PlateElement>
    );
  }

  return (
    <PlateElement className="my-3" {...props}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        contentEditable={false}
        className="group flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 no-underline transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/60 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        onDoubleClick={(e) => {
          e.preventDefault();
          setDraft(url);
          setEditing(true);
        }}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-zinc-200 dark:bg-zinc-700">
          <ExternalLink size={14} className="text-fg-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg-secondary">
            {title || url}
          </p>
          {description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-fg-muted">
              {description}
            </p>
          )}
          <p className="mt-0.5 text-xs text-fg-muted">{hostname}</p>
        </div>
      </a>
      {props.children}
    </PlateElement>
  );
}
