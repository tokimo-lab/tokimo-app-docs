import katex from "katex";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useEditorRef, useElement } from "platejs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BlockToolbar } from "../components/BlockToolbar";
import { useBlockDrag } from "../hooks/use-block-drag";

function KatexRenderer({
  tex,
  displayMode,
}: {
  tex: string;
  displayMode: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (!tex) {
      ref.current.innerHTML = "";
      return;
    }
    try {
      katex.render(tex, ref.current, {
        displayMode,
        throwOnError: false,
        output: "html",
      });
    } catch {
      ref.current.textContent = tex;
    }
  }, [tex, displayMode]);

  return <div ref={ref} />;
}

export function EquationElement(props: PlateElementProps) {
  const editor = useEditorRef();
  const element = useElement();
  const tex =
    ((element as Record<string, unknown>).texExpression as string) || "";
  const [editing, setEditing] = useState(!tex);
  const [draft, setDraft] = useState(tex);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDragging, handleDragPointerDown } = useBlockDrag(containerRef);

  const commitEdit = useCallback(() => {
    const path = editor.api.findPath(element);
    if (path) {
      editor.tf.setNodes({ texExpression: draft } as Record<string, unknown>, {
        at: path,
      });
    }
    setEditing(false);
  }, [editor, element, draft]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <PlateElement className="my-4" {...props}>
      <div
        contentEditable={false}
        className={`group/block relative rounded bg-surface-base p-4 transition-opacity select-none ${isDragging ? "opacity-50" : ""}`}
      >
        <div ref={containerRef}>
          <BlockToolbar
            isDragging={isDragging}
            onPointerDown={handleDragPointerDown}
          />
        </div>
        {editing ? (
          <div className="flex flex-col items-center gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  commitEdit();
                }
                if (e.key === "Escape") {
                  setDraft(tex);
                  setEditing(false);
                }
              }}
              placeholder="E = mc^2"
              className="w-full max-w-lg resize-none rounded border border-border-base bg-surface-elevated px-3 py-2 font-mono text-sm text-fg-primary outline-none focus:border-[var(--accent)]"
              rows={2}
            />
            <p className="text-xs text-fg-muted">⌘+Enter 确认 · Esc 取消</p>
          </div>
        ) : (
          // biome-ignore lint/a11y/useKeyWithClickEvents: equation click to edit
          // biome-ignore lint/a11y/noStaticElementInteractions: equation click to edit
          <div
            className="flex cursor-pointer justify-center"
            onClick={() => {
              setDraft(tex);
              setEditing(true);
            }}
          >
            {tex ? (
              <KatexRenderer tex={tex} displayMode />
            ) : (
              <span className="text-sm text-fg-muted italic">点击输入公式</span>
            )}
          </div>
        )}
      </div>
      {props.children}
    </PlateElement>
  );
}

export function InlineEquationElement(props: PlateElementProps) {
  const editor = useEditorRef();
  const element = useElement();
  const tex =
    ((element as Record<string, unknown>).texExpression as string) || "";
  const [editing, setEditing] = useState(!tex);
  const [draft, setDraft] = useState(tex);
  const inputRef = useRef<HTMLInputElement>(null);

  const commitEdit = useCallback(() => {
    const path = editor.api.findPath(element);
    if (path) {
      editor.tf.setNodes({ texExpression: draft } as Record<string, unknown>, {
        at: path,
      });
    }
    setEditing(false);
  }, [editor, element, draft]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <PlateElement
      as="span"
      className="inline-flex items-center rounded bg-fill-tertiary px-1"
      {...props}
    >
      <span contentEditable={false} className="select-none">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitEdit();
              }
              if (e.key === "Escape") {
                setDraft(tex);
                setEditing(false);
              }
            }}
            placeholder="x^2"
            className="w-24 border-none bg-transparent font-mono text-sm outline-none"
          />
        ) : (
          // biome-ignore lint/a11y/useKeyWithClickEvents: inline equation click to edit
          // biome-ignore lint/a11y/noStaticElementInteractions: inline equation click to edit
          <span
            className="cursor-pointer"
            onClick={() => {
              setDraft(tex);
              setEditing(true);
            }}
          >
            {tex ? (
              <KatexRenderer tex={tex} displayMode={false} />
            ) : (
              <span className="text-fg-muted italic">∅</span>
            )}
          </span>
        )}
      </span>
      {props.children}
    </PlateElement>
  );
}
