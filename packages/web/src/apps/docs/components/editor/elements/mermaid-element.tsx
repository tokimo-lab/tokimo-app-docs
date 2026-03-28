import mermaid from "mermaid";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useEditorRef, useElement } from "platejs/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useThemeCore } from "@/system/appearance/ThemeContext";

mermaid.initialize({ startOnLoad: false, theme: "default" });

function MermaidRenderer({ code, isDark }: { code: string; isDark: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const suffix = useId().replace(/:/g, "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !code) {
      if (containerRef.current) containerRef.current.innerHTML = "";
      setError(null);
      return;
    }

    let cancelled = false;
    const id = `mermaid-${suffix}-${Date.now()}`;

    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
    });

    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        setError(err instanceof Error ? err.message : String(err));
        // mermaid leaves error elements in the DOM
        document.getElementById(`d${id}`)?.remove();
      });

    return () => {
      cancelled = true;
    };
  }, [code, isDark, suffix]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          图表语法错误：{error}
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="flex justify-center" />;
}

export function MermaidElement(props: PlateElementProps) {
  const editor = useEditorRef();
  const element = useElement();
  const { theme } = useThemeCore();
  const isDark = theme === "dark";
  const code = ((element as Record<string, unknown>).code as string) || "";
  const [editing, setEditing] = useState(!code);
  const [draft, setDraft] = useState(code);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const commitEdit = useCallback(() => {
    const path = editor.api.findPath(element);
    if (path) {
      editor.tf.setNodes({ code: draft } as Record<string, unknown>, {
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
      className="group my-4 rounded border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900"
      {...props}
    >
      <div contentEditable={false} className="select-none">
        {editing ? (
          <div className="flex flex-col gap-3">
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
                  setDraft(code);
                  setEditing(false);
                }
              }}
              placeholder={"graph TD\n  A[开始] --> B[结束]"}
              className="w-full resize-none rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
              rows={6}
            />
            {draft && (
              <div className="rounded border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
                <MermaidRenderer code={draft} isDark={isDark} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitEdit();
                }}
                className="rounded bg-blue-500 px-3 py-1 text-xs font-medium text-white hover:bg-blue-600"
              >
                确认 (⌘+Enter)
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDraft(code);
                  setEditing(false);
                }}
                className="rounded bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
              >
                取消 (Esc)
              </button>
            </div>
          </div>
        ) : (
          // biome-ignore lint/a11y/useKeyWithClickEvents: mermaid click to edit
          // biome-ignore lint/a11y/noStaticElementInteractions: mermaid click to edit
          <div
            className="group/mermaid cursor-pointer"
            onClick={() => {
              setDraft(code);
              setEditing(true);
            }}
          >
            {code ? (
              <div className="relative">
                <MermaidRenderer code={code} isDark={isDark} />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-black/5 opacity-0 transition-opacity group-hover/mermaid:opacity-100 dark:bg-white/5">
                  <span className="rounded bg-black/60 px-2 py-1 text-xs text-white">
                    编辑图表
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-sm text-zinc-400 italic">
                点击输入 Mermaid 图表
              </span>
            )}
          </div>
        )}
      </div>
      {props.children}
    </PlateElement>
  );
}
