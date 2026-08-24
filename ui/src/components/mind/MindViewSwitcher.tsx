/**
 * Unified floating toolbar for the mind editor.
 *
 * View toggle (outline / mind map) in a single vertical pill.
 * Direction buttons have moved to MindBottomToolbar's branch display popover.
 */

import { useTranslation } from "react-i18next";

export type ViewMode = "mindmap" | "outline";

interface MindViewSwitcherProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
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

// ── Shared button style ────────────────────────────────────────────────────

const BTN_BASE =
  "cursor-pointer p-1.5 transition-colors flex items-center justify-center";
const BTN_ACTIVE =
  "bg-accent-subtle text-accent-text";
const BTN_INACTIVE =
  "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300";

// ── Component ──────────────────────────────────────────────────────────────

export function MindViewSwitcher({
  mode,
  onModeChange,
}: MindViewSwitcherProps) {
  const { t } = useTranslation();

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
    </div>
  );
}
