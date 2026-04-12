import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { setActiveTextEditor } from "../lib/slide-text-editor-bridge";
import { createSlideExtensions } from "../lib/tiptap-extensions";
import "../lib/tiptap-prose.css";
import type { SlideTextElement } from "../types";

interface TextElementProps {
  element: SlideTextElement;
  selected: boolean;
  scale: number;
  onSelect: (id: string, append: boolean) => void;
  onUpdate: (id: string, updates: Partial<SlideTextElement>) => void;
}

const extensions = createSlideExtensions();

export function TextElement({
  element,
  selected,
  scale: _scale,
  onSelect,
  onUpdate,
}: TextElementProps) {
  const [editing, setEditing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const onUpdateRef = useRef(onUpdate);
  const elementIdRef = useRef(element.id);
  onUpdateRef.current = onUpdate;
  elementIdRef.current = element.id;

  const editor = useEditor({
    extensions,
    content: element.content,
    editable: false,
    editorProps: {
      attributes: {
        class: "tiptap-slide-text",
      },
    },
  });

  // Sync content from props when not editing
  useEffect(() => {
    if (!editor || editing) return;
    const current = editor.getHTML();
    if (current !== element.content) {
      editor.commands.setContent(element.content, { emitUpdate: false });
    }
  }, [editor, element.content, editing]);

  // Cleanup bridge on unmount
  useEffect(() => {
    return () => setActiveTextEditor(null);
  }, []);

  const exitEditing = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    editor.setEditable(false);
    setEditing(false);
    setActiveTextEditor(null);
    onUpdateRef.current(elementIdRef.current, { content: html });
  }, [editor]);

  // Click-outside detection
  useEffect(() => {
    if (!editing) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        exitEditing();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [editing, exitEditing]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (editing) {
        // Don't propagate to drag handler while typing
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      onSelect(element.id, e.shiftKey);
    },
    [element.id, onSelect, editing],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!editor) return;
      editor.setEditable(true);
      setEditing(true);
      setActiveTextEditor(editor);
      requestAnimationFrame(() => editor.commands.focus("end"));
    },
    [editor],
  );

  const contentStyle: React.CSSProperties = {
    fontFamily: element.defaultFontName,
    color: element.defaultColor,
    backgroundColor: element.fill || "transparent",
    lineHeight: element.lineHeight ?? 1.5,
    letterSpacing: element.wordSpace ? `${element.wordSpace}px` : undefined,
    writingMode: element.vertical ? "vertical-rl" : undefined,
  };

  return (
    <div
      ref={wrapperRef}
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
      <div
        className="h-full w-full overflow-hidden"
        style={{
          ...contentStyle,
          pointerEvents: editing ? "auto" : "none",
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
