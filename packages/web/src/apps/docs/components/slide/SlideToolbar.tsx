import { ChevronDown, Image, Maximize, Redo2, Type, Undo2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { SHAPES } from "./lib/shapes";
import type { SlideShapeElement } from "./types";
import {
  createTextElement,
  generateId,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from "./types";
import { useSlideStore } from "./use-slide-store";

interface SlideToolbarProps {
  onPresent: () => void;
}

export function SlideToolbar({ onPresent }: SlideToolbarProps) {
  const addElement = useSlideStore((s) => s.addElement);
  const undo = useSlideStore((s) => s.undo);
  const redo = useSlideStore((s) => s.redo);
  const historyIndex = useSlideStore((s) => s.historyIndex);

  const [textMenuOpen, setTextMenuOpen] = useState(false);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddText = useCallback(
    (textType: "title" | "subtitle" | "body" | "heading" | "small") => {
      addElement(createTextElement(textType));
      setTextMenuOpen(false);
    },
    [addElement],
  );

  const handleAddShape = useCallback(
    (shape: (typeof SHAPES)[number]) => {
      const el: SlideShapeElement = {
        id: generateId(),
        type: "shape",
        left: (VIEWPORT_WIDTH - 200) / 2,
        top: (VIEWPORT_HEIGHT - 200) / 2,
        width: 200,
        height: 200,
        rotate: 0,
        viewBox: shape.viewBox,
        path: shape.path,
        fill: "#5B9BD5",
      };
      addElement(el);
      setShapeMenuOpen(false);
    },
    [addElement],
  );

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        const img = new window.Image();
        img.onload = () => {
          const maxW = 600;
          const maxH = 400;
          let w = img.width;
          let h = img.height;
          if (w > maxW || h > maxH) {
            const ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          addElement({
            id: generateId(),
            type: "image",
            left: (VIEWPORT_WIDTH - w) / 2,
            top: (VIEWPORT_HEIGHT - h) / 2,
            width: w,
            height: h,
            rotate: 0,
            src,
            fixedRatio: true,
          });
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [addElement],
  );

  return (
    <div className="flex items-center gap-1 border-b border-border-subtle bg-fill-secondary px-3 py-1 dark:bg-neutral-900">
      {/* Text dropdown */}
      <div className="relative">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs hover:bg-fill-tertiary"
          onClick={() => {
            setTextMenuOpen(!textMenuOpen);
            setShapeMenuOpen(false);
          }}
        >
          <Type size={14} />
          文本
          <ChevronDown size={12} />
        </button>
        {textMenuOpen && (
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: no keyboard interaction needed */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setTextMenuOpen(false)}
            />
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[120px] rounded-md border border-border-subtle bg-white py-1 shadow-lg dark:bg-neutral-800">
              {(
                [
                  ["title", "大标题"],
                  ["heading", "标题"],
                  ["subtitle", "副标题"],
                  ["body", "正文"],
                  ["small", "小号正文"],
                ] as const
              ).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  className="block w-full cursor-pointer px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
                  onClick={() => handleAddText(type)}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Shape dropdown */}
      <div className="relative">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs hover:bg-fill-tertiary"
          onClick={() => {
            setShapeMenuOpen(!shapeMenuOpen);
            setTextMenuOpen(false);
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
          图形
          <ChevronDown size={12} />
        </button>
        {shapeMenuOpen && (
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: no keyboard interaction needed */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShapeMenuOpen(false)}
            />
            <div className="absolute left-0 top-full z-50 mt-1 grid grid-cols-4 gap-1 rounded-md border border-border-subtle bg-white p-2 shadow-lg dark:bg-neutral-800">
              {SHAPES.map((shape) => (
                <button
                  key={shape.name}
                  type="button"
                  className="flex cursor-pointer flex-col items-center gap-0.5 rounded p-1.5 hover:bg-fill-tertiary"
                  title={shape.label}
                  onClick={() => handleAddShape(shape)}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox={`0 0 ${shape.viewBox[0]} ${shape.viewBox[1]}`}
                  >
                    <path d={shape.path} fill="#666" />
                  </svg>
                  <span className="text-[10px] text-fg-muted">
                    {shape.label}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Image */}
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs hover:bg-fill-tertiary"
        onClick={() => fileInputRef.current?.click()}
      >
        <Image size={14} />
        图片
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      <div className="mx-2 h-4 w-px bg-border-subtle" />

      {/* Undo/Redo */}
      <button
        type="button"
        className="cursor-pointer rounded p-1 hover:bg-fill-tertiary disabled:opacity-30"
        onClick={undo}
        disabled={historyIndex < 0}
        title="撤销 (Ctrl+Z)"
      >
        <Undo2 size={14} />
      </button>
      <button
        type="button"
        className="cursor-pointer rounded p-1 hover:bg-fill-tertiary disabled:opacity-30"
        onClick={redo}
        title="重做 (Ctrl+Shift+Z)"
      >
        <Redo2 size={14} />
      </button>

      <div className="flex-1" />

      {/* Present */}
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 rounded bg-blue-500 px-3 py-1 text-xs text-white transition-colors hover:bg-blue-600"
        onClick={onPresent}
      >
        <Maximize size={14} />
        演示
      </button>
    </div>
  );
}
