/**
 * MarkdownEditor — Split-pane markdown editor with live preview.
 *
 * Left: textarea for editing raw markdown.
 * Right: rendered markdown preview via @tokimo/ui Markdown.
 */

import { Markdown } from "@tokimo/ui";
import { Columns2, Code2, Download, Eye, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type MarkdownViewMode = "source" | "split" | "preview";

interface MarkdownEditorProps {
  /** Document node ID (used as React key externally) */
  spaceId: string;
  relPath: string;
  /** Raw markdown text (from doc_nodes.content parsed as JSON string) */
  content: string;
  /** Document title */
  title: string;
  /** Called when content changes (debounced externally) */
  onContentChange: (text: string) => void;
  /** Called when title changes */
  onTitleChange: (title: string) => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
}

export function MarkdownEditor({
  spaceId: _spaceId,
  relPath,
  content,
  title,
  onContentChange,
  onTitleChange,
  readOnly = false,
}: MarkdownEditorProps) {
  const { t } = useTranslation();
  const [localContent, setLocalContent] = useState(content);
  const [localTitle, setLocalTitle] = useState(title);
  const [viewMode, setViewMode] = useState<MarkdownViewMode>("split");
  const [compact, setCompact] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const prevNodeIdRef = useRef(relPath);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCompact(entry.contentRect.width < 720);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // Reset local state when switching to a different document
  if (prevNodeIdRef.current !== relPath) {
    prevNodeIdRef.current = relPath;
    setLocalContent(content);
    setLocalTitle(title);
  }

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setLocalContent(text);
      onContentChange(text);
    },
    [onContentChange],
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setLocalTitle(newTitle);
      onTitleChange(newTitle);
    },
    [onTitleChange],
  );

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      try {
        const text = await file.text();
        setLocalContent(text);
        onContentChange(text);
        setNotice(t("docs.markdownImported"));
      } catch {
        setNotice(t("docs.markdownImportFailed"));
      }
    },
    [onContentChange, t],
  );

  const handleExport = useCallback(() => {
    const blob = new Blob([localContent], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = localTitle.trim().replace(/[\\/:*?"<>|]+/g, "-");
    link.download = `${safeTitle || "document"}.md`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    setNotice(t("docs.markdownExported"));
  }, [localContent, localTitle, t]);

  // Handle Tab key in textarea (insert 2 spaces instead of changing focus)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        const newValue = `${value.substring(0, start)}  ${value.substring(end)}`;
        setLocalContent(newValue);
        onContentChange(newValue);
        requestAnimationFrame(() => {
          textarea.selectionStart = start + 2;
          textarea.selectionEnd = start + 2;
        });
      }
    },
    [onContentChange],
  );

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col">
      {/* Title + view and file actions */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-5 py-3">
        <input
          type="text"
          value={localTitle}
          onChange={handleTitleChange}
          readOnly={readOnly}
          className="min-w-[180px] flex-1 bg-transparent text-2xl font-bold text-fg-primary outline-none placeholder:text-fg-muted"
          placeholder="Untitled"
        />
        <div className="flex items-center gap-1 rounded-lg bg-fill-tertiary p-1">
          {(
            [
              ["source", Code2, t("docs.markdownSource")],
              ["split", Columns2, t("docs.markdownSplit")],
              ["preview", Eye, t("docs.markdownPreview")],
            ] as const
          ).map(([mode, Icon, label]) => (
            <button
              key={mode}
              type="button"
              className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
                viewMode === mode
                  ? "bg-bg-base text-fg-primary shadow-sm"
                  : "text-fg-muted hover:text-fg-primary"
              }`}
              aria-pressed={viewMode === mode}
              title={label}
              onClick={() => setViewMode(mode)}
            >
              <Icon size={14} />
              {!compact && <span>{label}</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <input
            ref={importInputRef}
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            className="hidden"
            onChange={handleImport}
          />
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-primary"
            title={t("docs.markdownImport")}
            onClick={() => importInputRef.current?.click()}
          >
            <Upload size={14} />
            {!compact && <span>{t("docs.markdownImport")}</span>}
          </button>
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-primary"
            title={t("docs.markdownExport")}
            onClick={handleExport}
          >
            <Download size={14} />
            {!compact && <span>{t("docs.markdownExport")}</span>}
          </button>
        </div>
        {notice && (
          <button
            type="button"
            className="cursor-pointer text-xs text-fg-muted"
            role="status"
            title={t("docs.dismiss")}
            onClick={() => setNotice(null)}
          >
            {notice}
          </button>
        )}
      </div>

      {/* Source, split, or rendered preview */}
      <div
        className={`flex min-h-0 flex-1 ${
          compact && viewMode === "split" ? "flex-col" : "flex-row"
        }`}
      >
        {/* Left: markdown source editor */}
        {viewMode !== "preview" && (
          <div
            className={`flex min-h-0 flex-col ${
              viewMode === "source"
                ? "w-full"
                : compact
                  ? "h-1/2 w-full border-b border-border-subtle"
                  : "w-1/2 border-r border-border-subtle"
            }`}
          >
          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            readOnly={readOnly}
            className="flex-1 resize-none bg-transparent px-6 py-4 font-mono text-sm leading-relaxed text-fg-primary outline-none placeholder:text-fg-muted"
            placeholder="Write your markdown here..."
            spellCheck={false}
          />
          </div>
        )}

        {/* Right: rendered preview */}
        {viewMode !== "source" && (
          <div
            className={`min-h-0 overflow-y-auto px-6 py-4 ${
              viewMode === "preview"
                ? "w-full"
                : compact
                  ? "h-1/2 w-full"
                  : "w-1/2"
            }`}
          >
            <Markdown content={localContent} />
          </div>
        )}
      </div>
    </div>
  );
}
