import { Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { Slide } from "./types";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "./types";
import { useSlideStore } from "./use-slide-store";

const THUMB_WIDTH = 160;
const THUMB_SCALE = THUMB_WIDTH / VIEWPORT_WIDTH;
const THUMB_HEIGHT = Math.round(VIEWPORT_HEIGHT * THUMB_SCALE);

export function SlideThumbnailPanel() {
  const slides = useSlideStore((s) => s.presentation.slides);
  const currentIndex = useSlideStore((s) => s.currentSlideIndex);
  const setCurrentIndex = useSlideStore((s) => s.setCurrentSlideIndex);
  const addSlide = useSlideStore((s) => s.addSlide);
  const deleteSlide = useSlideStore((s) => s.deleteSlide);
  const duplicateSlide = useSlideStore((s) => s.duplicateSlide);
  const reorderSlide = useSlideStore((s) => s.reorderSlide);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    index: number;
  } | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, index });
    },
    [],
  );

  const closeMenu = useCallback(() => setContextMenu(null), []);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      const from = dragIndexRef.current;
      if (from !== null && from !== targetIndex) {
        reorderSlide(from, targetIndex);
      }
      dragIndexRef.current = null;
    },
    [reorderSlide],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const renderThumb = (slide: Slide) => {
    const bg = slide.background;
    const bgStyle: React.CSSProperties = { backgroundColor: "#fff" };
    if (bg?.type === "solid" && bg.color) bgStyle.backgroundColor = bg.color;
    else if (bg?.type === "gradient" && bg.gradient) {
      const stops = bg.gradient.colors
        .map((c) => `${c.color} ${c.offset * 100}%`)
        .join(", ");
      bgStyle.background =
        bg.gradient.type === "linear"
          ? `linear-gradient(${bg.gradient.angle ?? 0}deg, ${stops})`
          : `radial-gradient(circle, ${stops})`;
    }

    return (
      <div
        className="relative overflow-hidden"
        style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT, ...bgStyle }}
      >
        {slide.elements
          .filter(
            (el): el is Extract<typeof el, { type: "text" }> =>
              el.type === "text",
          )
          .slice(0, 3)
          .map((el) => (
            <div
              key={el.id}
              className="absolute overflow-hidden text-[4px] leading-tight"
              style={{
                left: el.left * THUMB_SCALE,
                top: el.top * THUMB_SCALE,
                width: el.width * THUMB_SCALE,
                height: el.height * THUMB_SCALE,
                color: el.defaultColor,
              }}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: thumbnail preview of user-authored slide text
              dangerouslySetInnerHTML={{ __html: el.content }}
            />
          ))}
        {slide.elements
          .filter((el) => el.type === "shape" || el.type === "image")
          .slice(0, 5)
          .map((el) => (
            <div
              key={el.id}
              className="absolute rounded-sm"
              style={{
                left: el.left * THUMB_SCALE,
                top: el.top * THUMB_SCALE,
                width: el.width * THUMB_SCALE,
                height: el.height * THUMB_SCALE,
                backgroundColor:
                  el.type === "shape"
                    ? (el as Extract<typeof el, { type: "shape" }>).fill
                    : "#e0e0e0",
                opacity: 0.6,
              }}
            />
          ))}
      </div>
    );
  };

  return (
    <div className="flex w-[200px] flex-shrink-0 flex-col border-r border-border-subtle bg-fill-secondary dark:bg-neutral-900">
      <div className="flex-1 overflow-y-auto p-2">
        {slides.map((slide, i) => (
          // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard navigation not needed for thumbnail items
          // biome-ignore lint/a11y/noStaticElementInteractions: thumbnail items need drag and context menu interaction
          <div
            key={slide.id}
            className={`mb-2 cursor-pointer rounded border-2 transition-colors ${
              i === currentIndex
                ? "border-blue-500"
                : "border-transparent hover:border-neutral-300 dark:hover:border-neutral-600"
            }`}
            onClick={() => setCurrentIndex(i)}
            onContextMenu={(e) => handleContextMenu(e, i)}
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragOver={handleDragOver}
          >
            <div className="flex items-center gap-1 px-1 pt-1">
              <span className="text-[10px] text-fg-muted">{i + 1}</span>
            </div>
            {renderThumb(slide)}
          </div>
        ))}
      </div>

      <div className="border-t border-border-subtle p-2">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-center gap-1 rounded px-2 py-1.5 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary"
          onClick={() => addSlide(currentIndex)}
        >
          <Plus size={14} />
          新建幻灯片
        </button>
      </div>

      {contextMenu && (
        <>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay to close context menu */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: no keyboard interaction needed for backdrop */}
          <div className="fixed inset-0 z-50" onClick={closeMenu} />
          <div
            className="fixed z-50 min-w-[140px] rounded-md border border-border-subtle bg-white py-1 shadow-lg dark:bg-neutral-800"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              className="block w-full cursor-pointer px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
              onClick={() => {
                addSlide(contextMenu.index);
                closeMenu();
              }}
            >
              新建幻灯片
            </button>
            <button
              type="button"
              className="block w-full cursor-pointer px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
              onClick={() => {
                duplicateSlide(contextMenu.index);
                closeMenu();
              }}
            >
              复制
            </button>
            <button
              type="button"
              className="block w-full cursor-pointer px-3 py-1.5 text-left text-xs text-red-500 hover:bg-fill-tertiary"
              onClick={() => {
                deleteSlide(contextMenu.index);
                closeMenu();
              }}
            >
              删除
            </button>
          </div>
        </>
      )}
    </div>
  );
}
