import { useCallback, useRef, useState } from "react";
import type { SlideTextElement } from "../types";

interface TextElementProps {
  element: SlideTextElement;
  selected: boolean;
  scale: number;
  onSelect: (id: string, append: boolean) => void;
  onUpdate: (id: string, updates: Partial<SlideTextElement>) => void;
}

export function TextElement({
  element,
  selected,
  scale: _scale,
  onSelect,
  onUpdate,
}: TextElementProps) {
  const [editing, setEditing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (editing) return;
      e.stopPropagation();
      onSelect(element.id, e.shiftKey);
    },
    [element.id, onSelect, editing],
  );

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    requestAnimationFrame(() => contentRef.current?.focus());
  }, []);

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (contentRef.current) {
      onUpdate(element.id, { content: contentRef.current.innerHTML });
    }
  }, [element.id, onUpdate]);

  return (
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
        cursor: editing ? "text" : "move",
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      role="application"
    >
      {editing ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: contentEditable div acts as inline text editor
        <div
          ref={contentRef}
          className="h-full w-full overflow-hidden"
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          style={{
            fontFamily: element.defaultFontName,
            color: element.defaultColor,
            backgroundColor: element.fill || "transparent",
            lineHeight: element.lineHeight ?? 1.5,
            letterSpacing: element.wordSpace
              ? `${element.wordSpace}px`
              : undefined,
            writingMode: element.vertical ? "vertical-rl" : undefined,
          }}
        />
      ) : (
        <div
          className="h-full w-full overflow-hidden"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: slide text content is user-authored HTML
          dangerouslySetInnerHTML={{ __html: element.content }}
          style={{
            fontFamily: element.defaultFontName,
            color: element.defaultColor,
            backgroundColor: element.fill || "transparent",
            lineHeight: element.lineHeight ?? 1.5,
            letterSpacing: element.wordSpace
              ? `${element.wordSpace}px`
              : undefined,
            writingMode: element.vertical ? "vertical-rl" : undefined,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
