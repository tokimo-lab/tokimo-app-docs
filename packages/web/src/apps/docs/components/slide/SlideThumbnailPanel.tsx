import { Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SlideRenderer } from "./SlideRenderer";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "./types";
import { useSlideStore } from "./use-slide-store";

const THUMB_WIDTH = 156;
const THUMB_SCALE = THUMB_WIDTH / VIEWPORT_WIDTH;
const THUMB_HEIGHT = Math.round(VIEWPORT_HEIGHT * THUMB_SCALE);

export function SlideThumbnailPanel() {
  const { t } = useTranslation();
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

  return (
    <div className="flex w-[210px] flex-shrink-0 flex-col border-r border-border-subtle bg-fill-secondary dark:bg-neutral-900">
      {/* New slide button — Feishu style */}
      <div className="px-3 pt-3 pb-1">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-blue-400 bg-blue-50/50 px-3 py-2 text-xs font-medium text-blue-600 transition-colors hover:border-blue-500 hover:bg-blue-50 dark:border-blue-500/50 dark:bg-blue-900/10 dark:text-blue-400 dark:hover:border-blue-400 dark:hover:bg-blue-900/20"
          onClick={() => addSlide(currentIndex)}
        >
          <Plus size={14} strokeWidth={2.5} />
          {t("docs.slideNewSlide")}
        </button>
      </div>

      {/* Thumbnail list */}
      <div className="flex-1 overflow-y-auto px-1 py-2">
        {slides.map((slide, i) => (
          // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard navigation not needed for thumbnail items
          // biome-ignore lint/a11y/noStaticElementInteractions: thumbnail items need drag and context menu interaction
          <div
            key={slide.id}
            className="group mb-1.5 flex cursor-pointer items-start gap-1 px-1"
            onClick={() => setCurrentIndex(i)}
            onContextMenu={(e) => handleContextMenu(e, i)}
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragOver={handleDragOver}
          >
            {/* Slide number — outside the border */}
            <span
              className={`mt-1 w-5 shrink-0 text-right text-[11px] leading-none ${
                i === currentIndex
                  ? "font-medium text-blue-600 dark:text-blue-400"
                  : "text-fg-muted"
              }`}
            >
              {i + 1}
            </span>
            {/* Thumbnail with selection border */}
            <div
              className={`overflow-hidden rounded-sm border-2 transition-colors ${
                i === currentIndex
                  ? "border-blue-500 dark:border-blue-400"
                  : "border-transparent group-hover:border-neutral-300 dark:group-hover:border-neutral-600"
              }`}
            >
              <SlideRenderer
                slide={slide}
                width={THUMB_WIDTH}
                height={THUMB_HEIGHT}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Context menu */}
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
              {t("docs.slideNewSlide")}
            </button>
            <button
              type="button"
              className="block w-full cursor-pointer px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
              onClick={() => {
                duplicateSlide(contextMenu.index);
                closeMenu();
              }}
            >
              {t("docs.slideDuplicate")}
            </button>
            <button
              type="button"
              className="block w-full cursor-pointer px-3 py-1.5 text-left text-xs text-red-500 hover:bg-fill-tertiary"
              onClick={() => {
                deleteSlide(contextMenu.index);
                closeMenu();
              }}
            >
              {t("docs.slideDelete")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
