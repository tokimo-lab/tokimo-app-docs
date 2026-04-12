import { cn } from "@tokiomo/components";
import {
  BarChart3,
  Film,
  Image as ImageIcon,
  MessageSquare,
  Paintbrush,
  PenTool,
  Pentagon,
  Redo2,
  Sparkles,
  Table2,
  Type,
  Undo2,
} from "lucide-react";
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
  activePanel: string | null;
  onPanelChange: (panel: string | null) => void;
}

export function SlideToolbar({
  activePanel,
  onPanelChange,
}: SlideToolbarProps) {
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

  const closeAllMenus = useCallback(() => {
    setTextMenuOpen(false);
    setShapeMenuOpen(false);
  }, []);

  const itemClass = (active: boolean) =>
    cn(
      "flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1.5 min-w-[44px]",
      "hover:bg-black/5 dark:hover:bg-white/5",
      active && "bg-blue-50 text-blue-500 dark:bg-blue-500/10",
    );

  return (
    <div className="flex items-center gap-0.5 py-1">
      {/* Undo/Redo */}
      <button
        type="button"
        className="cursor-pointer rounded p-1.5 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30"
        onClick={undo}
        disabled={historyIndex < 0}
        title="撤销 (Ctrl+Z)"
      >
        <Undo2 size={16} />
      </button>
      <button
        type="button"
        className="cursor-pointer rounded p-1.5 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30"
        onClick={redo}
        title="重做 (Ctrl+Shift+Z)"
      >
        <Redo2 size={16} />
      </button>

      <div className="mx-1.5 h-5 w-px bg-border-subtle" />

      {/* Text dropdown */}
      <div className="relative">
        <button
          type="button"
          className={itemClass(textMenuOpen)}
          onClick={() => {
            setTextMenuOpen(!textMenuOpen);
            setShapeMenuOpen(false);
          }}
        >
          <Type size={18} />
          <span className="text-[11px] leading-tight">文本</span>
        </button>
        {textMenuOpen && (
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: no keyboard interaction needed */}
            <div className="fixed inset-0 z-40" onClick={closeAllMenus} />
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
                  className="block w-full cursor-pointer px-3 py-1.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5"
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
          className={itemClass(shapeMenuOpen)}
          onClick={() => {
            setShapeMenuOpen(!shapeMenuOpen);
            setTextMenuOpen(false);
          }}
        >
          <Pentagon size={18} />
          <span className="text-[11px] leading-tight">图形</span>
        </button>
        {shapeMenuOpen && (
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: no keyboard interaction needed */}
            <div className="fixed inset-0 z-40" onClick={closeAllMenus} />
            <div className="absolute left-0 top-full z-50 mt-1 grid grid-cols-4 gap-1 rounded-md border border-border-subtle bg-white p-2 shadow-lg dark:bg-neutral-800">
              {SHAPES.map((shape) => (
                <button
                  key={shape.name}
                  type="button"
                  className="flex cursor-pointer flex-col items-center gap-0.5 rounded p-1.5 hover:bg-black/5 dark:hover:bg-white/5"
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
        className={itemClass(false)}
        onClick={() => {
          closeAllMenus();
          fileInputRef.current?.click();
        }}
      >
        <ImageIcon size={18} />
        <span className="text-[11px] leading-tight">图片</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* 媒体 */}
      <button type="button" className={itemClass(false)}>
        <Film size={18} />
        <span className="text-[11px] leading-tight">媒体</span>
      </button>

      {/* 图表 */}
      <button type="button" className={itemClass(false)}>
        <BarChart3 size={18} />
        <span className="text-[11px] leading-tight">图表</span>
      </button>

      {/* 表格 */}
      <button type="button" className={itemClass(false)}>
        <Table2 size={18} />
        <span className="text-[11px] leading-tight">表格</span>
      </button>

      {/* 绘图 */}
      <button type="button" className={itemClass(false)}>
        <PenTool size={18} />
        <span className="text-[11px] leading-tight">绘图</span>
      </button>

      {/* 格式 */}
      <button
        type="button"
        className={itemClass(activePanel === "format")}
        onClick={() => {
          closeAllMenus();
          onPanelChange("format");
        }}
      >
        <Paintbrush size={18} />
        <span className="text-[11px] leading-tight">格式</span>
      </button>

      {/* 动画 */}
      <button type="button" className={itemClass(false)}>
        <Sparkles size={18} />
        <span className="text-[11px] leading-tight">动画</span>
      </button>

      {/* 评论 */}
      <button type="button" className={itemClass(false)}>
        <MessageSquare size={18} />
        <span className="text-[11px] leading-tight">评论</span>
      </button>
    </div>
  );
}
