import katex from "katex";
import "katex/dist/katex.min.css";
import { useCallback, useMemo, useState } from "react";
import type { SlideLatexElement } from "../types";

interface LaTeXElementProps {
  element: SlideLatexElement;
  selected: boolean;
  onSelect: (id: string, append: boolean) => void;
  onUpdate: (id: string, changes: Partial<SlideLatexElement>) => void;
}

export function LaTeXElement({
  element,
  selected,
  onSelect,
  onUpdate,
}: LaTeXElementProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(element.formula);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      onSelect(element.id, e.shiftKey);
    },
    [element.id, onSelect],
  );

  const handleDoubleClick = useCallback(() => {
    setDraft(element.formula);
    setEditing(true);
  }, [element.formula]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (draft !== element.formula) {
      onUpdate(element.id, { formula: draft });
    }
  }, [draft, element.formula, element.id, onUpdate]);

  const renderedHtml = useMemo(() => {
    try {
      return katex.renderToString(element.formula, {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      return '<span style="color:red">Invalid formula</span>';
    }
  }, [element.formula]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: slide element interaction
    <div
      data-element-id={element.id}
      className="absolute"
      style={{
        left: element.left,
        top: element.top,
        width: element.width,
        height: element.height,
        transform: `rotate(${element.rotate}deg)`,
        opacity: element.opacity ?? 1,
        outline: selected ? "2px solid #4A90D9" : undefined,
        outlineOffset: 2,
        cursor: "move",
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {editing ? (
        <textarea
          className="h-full w-full resize-none rounded border border-blue-400 bg-white p-2 font-mono text-sm dark:bg-neutral-900"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          // biome-ignore lint/a11y/noAutofocus: intentional focus on edit mode
          autoFocus
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center overflow-hidden"
          style={{
            fontSize: element.fontSize ?? 24,
            color: element.color ?? "#333",
          }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX HTML output
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      )}
    </div>
  );
}
