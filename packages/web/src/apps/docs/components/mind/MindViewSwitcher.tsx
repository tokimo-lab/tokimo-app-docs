/**
 * Unified floating toolbar for the mind editor.
 *
 * Combines the view toggle (outline / mind map) with mind-elixir's
 * direction buttons (left, right, side) in a single horizontal pill.
 * Replaces mind-elixir's built-in lt toolbar (hidden via CSS).
 */

import type { MindElixirInstance } from "mind-elixir";
import { useTranslation } from "react-i18next";

export type ViewMode = "mindmap" | "outline";

interface MindViewSwitcherProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  /** Mind-elixir instance for direction switching. Null hides direction buttons. */
  mind: MindElixirInstance | null;
}

// ── Inline SVG icons (small, no external deps) ─────────────────────────────

function OutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <path
        d="M2 4h12M4 8h10M4 12h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MindMapIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <circle cx="4" cy="8" r="2" fill="currentColor" />
      <circle cx="12" cy="4" r="1.5" fill="currentColor" />
      <circle cx="12" cy="8" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <path
        d="M6 8h2.5M8.5 8V4H10.5M8.5 8V12H10.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Left-only layout: root on left, branches to right */
function LayoutRightIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <path
        d="M3 8h4M7 8V4h3M7 8V12h3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Right-only layout: root on right, branches to left */
function LayoutLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <path
        d="M13 8H9M9 8V4H6M9 8V12H6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Side (both) layout: branches on both sides */
function LayoutSideIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <path
        d="M8 5V11M8 5H11M8 5H5M8 11H11M8 11H5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Shared button style ────────────────────────────────────────────────────

const BTN_BASE =
  "cursor-pointer p-1.5 transition-colors flex items-center justify-center";
const BTN_ACTIVE =
  "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
const BTN_INACTIVE =
  "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300";
const DIVIDER = "h-px w-full bg-gray-200 dark:bg-gray-600 mx-1";

// ── Component ──────────────────────────────────────────────────────────────

export function MindViewSwitcher({
  mode,
  onModeChange,
  mind,
}: MindViewSwitcherProps) {
  const { t } = useTranslation();

  const handleDirection = (dir: 0 | 1 | 2) => {
    if (!mind) return;
    if (dir === 0) mind.initLeft();
    else if (dir === 1) mind.initRight();
    else mind.initSide();
  };

  const showDirections = mode === "mindmap" && mind;

  return (
    <div className="absolute top-3 left-3 z-50 flex w-8 flex-col items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-[#2b2f36]">
      {/* View toggle: outline */}
      <button
        type="button"
        className={`${BTN_BASE} ${mode === "outline" ? BTN_ACTIVE : BTN_INACTIVE}`}
        title={t("docs.outlineView")}
        onClick={() => onModeChange("outline")}
      >
        <OutlineIcon />
      </button>

      {/* View toggle: mind map */}
      <button
        type="button"
        className={`${BTN_BASE} ${mode === "mindmap" ? BTN_ACTIVE : BTN_INACTIVE}`}
        title={t("docs.mindMapView")}
        onClick={() => onModeChange("mindmap")}
      >
        <MindMapIcon />
      </button>

      {/* Direction buttons (only in mindmap mode) */}
      {showDirections && (
        <>
          <div className={DIVIDER} />
          <button
            type="button"
            className={`${BTN_BASE} ${BTN_INACTIVE}`}
            title={t("docs.layoutLeft")}
            onClick={() => handleDirection(0)}
          >
            <LayoutLeftIcon />
          </button>
          <button
            type="button"
            className={`${BTN_BASE} ${BTN_INACTIVE}`}
            title={t("docs.layoutRight")}
            onClick={() => handleDirection(1)}
          >
            <LayoutRightIcon />
          </button>
          <button
            type="button"
            className={`${BTN_BASE} ${BTN_INACTIVE}`}
            title={t("docs.layoutSide")}
            onClick={() => handleDirection(2)}
          >
            <LayoutSideIcon />
          </button>
        </>
      )}
    </div>
  );
}
