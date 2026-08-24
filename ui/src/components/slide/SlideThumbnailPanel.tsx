import { ChevronDown, ChevronsLeft, ChevronsRight, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { SLIDE_LAYOUTS } from "./lib/layouts";
import { SlideRenderer } from "./SlideRenderer";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "./types";
import { useSlideStore } from "./use-slide-store";

const THUMB_WIDTH = 146;
const THUMB_SCALE = THUMB_WIDTH / VIEWPORT_WIDTH;
const THUMB_HEIGHT = Math.round(VIEWPORT_HEIGHT * THUMB_SCALE);

// Map layout id -> i18n key
const LAYOUT_I18N_KEYS: Record<string, string> = {
  blank: "docs.slideLayoutBlank",
  title: "docs.slideLayoutTitle",
  "title-list": "docs.slideLayoutTitleList",
  "cover-title": "docs.slideLayoutCoverTitle",
  "title-image": "docs.slideLayoutTitleImage",
  "title-two-col": "docs.slideLayoutTitleTwoCol",
  "title-three-col": "docs.slideLayoutTitleThreeCol",
  "title-four-col": "docs.slideLayoutTitleFourCol",
  "photo-wall": "docs.slideLayoutPhotoWall",
  "title-body": "docs.slideLayoutTitleBody",
};

interface SlideThumbnailPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function SlideThumbnailPanel({
  collapsed,
  onToggleCollapse,
}: SlideThumbnailPanelProps) {
  const { t } = useTranslation();
  const slides = useSlideStore((s) => s.presentation.slides);
  const currentIndex = useSlideStore((s) => s.currentSlideIndex);
  const setCurrentIndex = useSlideStore((s) => s.setCurrentSlideIndex);
  const addSlide = useSlideStore((s) => s.addSlide);
  const addSlideWithLayout = useSlideStore((s) => s.addSlideWithLayout);
  const deleteSlide = useSlideStore((s) => s.deleteSlide);
  const duplicateSlide = useSlideStore((s) => s.duplicateSlide);
  const reorderSlide = useSlideStore((s) => s.reorderSlide);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    index: number;
  } | null>(null);
  const [layoutDropdownOpen, setLayoutDropdownOpen] = useState(false);
  const splitBtnGroupRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
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

  const handleThumbnailKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setCurrentIndex(index);
        return;
      }
      if (!e.altKey) return;
      if (e.key === "ArrowUp" && index > 0) {
        e.preventDefault();
        reorderSlide(index, index - 1);
        setCurrentIndex(index - 1);
      } else if (e.key === "ArrowDown" && index < slides.length - 1) {
        e.preventDefault();
        reorderSlide(index, index + 1);
        setCurrentIndex(index + 1);
      }
    },
    [reorderSlide, setCurrentIndex, slides.length],
  );

  const handleInsertLayout = useCallback(
    (
      elements: readonly ReturnType<
        (typeof SLIDE_LAYOUTS)[0]["elements"]["at"]
      >[],
    ) => {
      addSlideWithLayout(currentIndex, [...elements] as Parameters<
        typeof addSlideWithLayout
      >[1]);
      setLayoutDropdownOpen(false);
    },
    [addSlideWithLayout, currentIndex],
  );

  // Close layout dropdown on outside click
  useEffect(() => {
    if (!layoutDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        splitBtnGroupRef.current &&
        !splitBtnGroupRef.current.contains(e.target as Node)
      ) {
        setLayoutDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [layoutDropdownOpen]);

  // Collapsed state: show a narrow expand button
  if (collapsed) {
    return (
      <div className="flex flex-shrink-0 flex-col items-center border-r border-border-subtle bg-white pt-4 dark:bg-neutral-900">
        <button
          type="button"
          className="cursor-pointer rounded p-1 hover:bg-gray-100 dark:hover:bg-neutral-700"
          onClick={onToggleCollapse}
          title={t("docs.slideExpandSidebar")}
        >
          <ChevronsRight
            size={16}
            className="text-gray-500 dark:text-neutral-400"
          />
        </button>
      </div>
    );
  }

  // Dropdown position (aligned with split button group)
  const splitRect = splitBtnGroupRef.current?.getBoundingClientRect();

  return (
    <div className="flex w-[196px] flex-shrink-0 flex-col bg-white dark:bg-neutral-900">
      {/* Top bar: split button + collapse */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "16px 6px 0 32px" }}
      >
        {/* Split button group */}
        <div ref={splitBtnGroupRef} className="flex h-8">
          {/* Main "新建幻灯片" button */}
          <button
            type="button"
            className="flex h-8 w-[102px] cursor-pointer items-center justify-center gap-1 rounded-l-[6px] border border-[rgb(208,211,214)] bg-white text-sm text-[rgb(31,35,41)] transition-colors hover:bg-gray-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            onClick={() => addSlide(currentIndex)}
          >
            <Plus size={12} />
            <span>{t("docs.slideNewSlide")}</span>
          </button>
          {/* Dropdown chevron button */}
          <button
            type="button"
            className="flex h-8 w-[27px] cursor-pointer items-center justify-center rounded-r-[6px] border border-l-0 border-[rgb(208,211,214)] bg-white transition-colors hover:bg-gray-50 dark:border-neutral-600 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            onClick={() => setLayoutDropdownOpen((prev) => !prev)}
          >
            <ChevronDown
              size={12}
              className="text-[rgb(31,35,41)] dark:text-neutral-200"
            />
          </button>
        </div>

        {/* Collapse button */}
        <button
          type="button"
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-neutral-700"
          onClick={onToggleCollapse}
          title={t("docs.slideCollapseSidebar")}
        >
          <ChevronsLeft
            size={16}
            className="text-gray-500 dark:text-neutral-400"
          />
        </button>
      </div>

      {/* Thumbnail list */}
      <div className="flex-1 overflow-y-auto py-2">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            className="relative cursor-pointer"
            style={{ padding: "8px 0" }}
            role="button"
            tabIndex={0}
            aria-label={t("docs.slideThumbnail", { index: i + 1 })}
            title={t("docs.slideReorderHint")}
            onClick={() => setCurrentIndex(i)}
            onKeyDown={(e) => handleThumbnailKeyDown(e, i)}
            onContextMenu={(e) => handleContextMenu(e, i)}
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragOver={handleDragOver}
          >
            {/* Slide number — absolute in left gutter */}
            <span
              className={`absolute left-[4px] top-[12px] w-[26px] text-center text-xs font-medium leading-3 ${
                i === currentIndex
                  ? "text-[rgb(20,86,240)] dark:text-[var(--accent)]"
                  : "text-[rgb(100,106,115)] dark:text-neutral-400"
              }`}
            >
              {i + 1}
            </span>
            {/* Selection border — wraps thumbnail area */}
            <div
              className={`ml-[28px] mr-[14px] rounded-[10px] border-2 p-px transition-colors ${
                i === currentIndex
                  ? "border-[rgb(20,86,240)] dark:border-[var(--accent)]"
                  : "border-transparent hover:border-[rgba(31,35,41,0.15)] dark:hover:border-neutral-500"
              }`}
            >
              {/* Thumbnail inner */}
              <div className="overflow-hidden rounded-[6px] border border-[rgba(31,35,41,0.15)] dark:border-neutral-600">
                <SlideRenderer
                  slide={slide}
                  width={THUMB_WIDTH}
                  height={THUMB_HEIGHT}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Layout template dropdown (portal) */}
      {layoutDropdownOpen &&
        splitRect &&
        createPortal(
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop to close dropdown */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: no keyboard needed for backdrop */}
            <div
              className="fixed inset-0 z-[200]"
              onClick={() => setLayoutDropdownOpen(false)}
            />
            <LayoutDropdown
              ref={dropdownRef}
              top={splitRect.bottom + 4}
              left={splitRect.left}
              onSelect={handleInsertLayout}
              t={t}
            />
          </>,
          document.body,
        )}

      {/* Context menu */}
      {contextMenu && (
        <>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay to close context menu */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: no keyboard interaction needed for backdrop */}
          <div className="fixed inset-0 z-[200]" onClick={closeMenu} />
          <div
            className="fixed z-[200] min-w-[140px] rounded-md border border-border-subtle bg-white py-1 shadow-lg dark:bg-neutral-800"
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

// ── Layout Dropdown ─────────────────────────────────────────

const LAYOUT_THUMB_W = 130;
const LAYOUT_THUMB_SCALE = LAYOUT_THUMB_W / VIEWPORT_WIDTH;
const LAYOUT_THUMB_H = Math.round(VIEWPORT_HEIGHT * LAYOUT_THUMB_SCALE);

import { forwardRef } from "react";
import type { SlideElement } from "./types";

interface LayoutDropdownProps {
  top: number;
  left: number;
  onSelect: (elements: SlideElement[]) => void;
  t: (key: string) => string;
}

const LayoutDropdown = forwardRef<HTMLDivElement, LayoutDropdownProps>(
  function LayoutDropdown({ top, left, onSelect, t }, ref) {
    return (
      <div
        ref={ref}
        className="fixed z-[200] w-[460px] rounded-lg bg-white dark:bg-neutral-800"
        style={{
          top,
          left,
          border: "1px solid rgb(222,224,227)",
          boxShadow:
            "rgba(31,35,41,0.04) 0px 8px 24px 8px, rgba(31,35,41,0.04) 0px 6px 12px 0px, rgba(31,35,41,0.06) 0px 4px 8px -8px",
          animation: "feishuDropdownIn 0.15s ease-out",
        }}
      >
        <style>{`
          @keyframes feishuDropdownIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        {/* Header — 46px tall */}
        <div
          className="flex h-[46px] items-center text-sm text-[rgb(31,35,41)] dark:text-neutral-200"
          style={{ padding: "0 12px" }}
        >
          {t("docs.slideSelectLayout")}
        </div>
        {/* Scrollable content */}
        <div className="max-h-[440px] overflow-y-auto px-3 pb-3">
          {/* Section label */}
          <div className="mb-2 text-xs text-[rgb(100,106,115)] dark:text-neutral-400">
            {t("docs.slideDefaultTemplate")}
          </div>
          {/* Grid — 3 columns */}
          <div className="grid grid-cols-3 gap-3">
            {SLIDE_LAYOUTS.map((layout) => (
              // biome-ignore lint/a11y/useKeyWithClickEvents: layout grid item
              // biome-ignore lint/a11y/noStaticElementInteractions: layout grid item
              <div
                key={layout.id}
                className="group cursor-pointer"
                onClick={() => onSelect(layout.elements)}
              >
                <div className="overflow-hidden rounded border border-black/10 transition-colors group-hover:border-[rgb(20,86,240)] dark:border-neutral-600 dark:group-hover:border-[var(--accent)]">
                  <SlideRenderer
                    slide={{ id: layout.id, elements: layout.elements }}
                    width={LAYOUT_THUMB_W}
                    height={LAYOUT_THUMB_H}
                  />
                </div>
                <div className="mt-1 truncate text-center text-xs text-[rgb(100,106,115)] dark:text-neutral-400">
                  {t(LAYOUT_I18N_KEYS[layout.id] ?? layout.name)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
);
