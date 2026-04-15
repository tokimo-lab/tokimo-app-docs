/**
 * MarkdownEditor — Simple markdown text editor for `markdown` type doc nodes.
 *
 * Content is stored as a plain markdown string in `doc_nodes.content` (JSON string).
 * Uses a plain textarea for editing; a future version may use CodeMirror.
 */

import { useCallback, useRef, useState } from "react";

interface MarkdownEditorProps {
  /** Document node ID (used as React key externally) */
  nodeId: string;
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
  nodeId,
  content,
  title,
  onContentChange,
  onTitleChange,
  readOnly = false,
}: MarkdownEditorProps) {
  const [localContent, setLocalContent] = useState(content);
  const [localTitle, setLocalTitle] = useState(title);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevNodeIdRef = useRef(nodeId);

  // Reset local state when switching to a different document
  if (prevNodeIdRef.current !== nodeId) {
    prevNodeIdRef.current = nodeId;
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
        // Restore cursor position after React re-render
        requestAnimationFrame(() => {
          textarea.selectionStart = start + 2;
          textarea.selectionEnd = start + 2;
        });
      }
    },
    [onContentChange],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Title input */}
      <div className="border-b border-border-subtle px-8 py-4">
        <input
          type="text"
          value={localTitle}
          onChange={handleTitleChange}
          readOnly={readOnly}
          className="w-full bg-transparent text-2xl font-bold text-fg-primary outline-none placeholder:text-fg-muted"
          placeholder="Untitled"
        />
      </div>

      {/* Markdown textarea */}
      <textarea
        ref={textareaRef}
        value={localContent}
        onChange={handleContentChange}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        className="flex-1 resize-none bg-transparent px-8 py-4 font-mono text-sm leading-relaxed text-fg-primary outline-none placeholder:text-fg-muted"
        placeholder="Write your markdown here..."
        spellCheck={false}
      />
    </div>
  );
}
