/**
 * Feishu-inspired bottom-left toolbar for the mind map editor.
 *
 * Provides undo/redo, branch display (structure + line style), and zoom.
 */

import type { MindElixirInstance } from "mind-elixir";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  angularMain,
  angularSub,
  curvedMain,
  curvedSub,
} from "./mind-branch-styles";

// ── Types ───────────────────────────────────────────────────────────────────

type Direction = 0 | 1 | 2;
type LineStyle = "curved" | "angular";

interface MindBottomToolbarProps {
  mind: MindElixirInstance | null;
}

// ── Shared button style ────────────────────────────────────────────────────

const BTN_BASE =
  "cursor-pointer p-1.5 transition-colors flex items-center justify-center";
const BTN_ACTIVE =
  "bg-blue-500/20 text-blue-500 dark:bg-blue-500/25 dark:text-blue-400";
const BTN_INACTIVE =
  "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300";
const DIVIDER = "w-full bg-gray-200 dark:bg-gray-600 mx-1";

// ── Inline SVG icons ───────────────────────────────────────────────────────

function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M4 6h6a3 3 0 0 1 0 6H7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 3L3.5 5.5L6 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M12 6H6a3 3 0 0 0 0 6h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 3l2.5 2.5L10 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BranchDisplayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M4 8h3M7 8V4.5h3M7 8V11.5h3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="3" cy="8" r="1.5" fill="currentColor" />
      <circle cx="11" cy="4.5" r="1.2" fill="currentColor" />
      <circle cx="11" cy="11.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M5 8h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 5v6M5 8h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Structure layout icons ─────────────────────────────────────────────────

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

// ── Line style icons ───────────────────────────────────────────────────────

function CurvedLineIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="16"
      viewBox="0 0 20 16"
      fill="none"
      className={className}
    >
      <path
        d="M3 8 Q3 4 10 4M3 8 Q3 12 10 12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="3" cy="8" r="1.5" fill="currentColor" />
      <rect
        x="10"
        y="2.5"
        width="7"
        height="3"
        rx="1"
        fill="currentColor"
        opacity="0.5"
      />
      <rect
        x="10"
        y="10.5"
        width="7"
        height="3"
        rx="1"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  );
}

function AngularLineIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="16"
      viewBox="0 0 20 16"
      fill="none"
      className={className}
    >
      <path
        d="M3 8H6V4H10M6 8V12H10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="3" cy="8" r="1.5" fill="currentColor" />
      <rect
        x="10"
        y="2.5"
        width="7"
        height="3"
        rx="1"
        fill="currentColor"
        opacity="0.5"
      />
      <rect
        x="10"
        y="10.5"
        width="7"
        height="3"
        rx="1"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  );
}

// ── Branch Display Popover ─────────────────────────────────────────────────

interface BranchPopoverProps {
  direction: Direction;
  lineStyle: LineStyle;
  onDirection: (dir: Direction) => void;
  onLineStyle: (style: LineStyle) => void;
  onClose: () => void;
}

function BranchPopover({
  direction,
  lineStyle,
  onDirection,
  onLineStyle,
  onClose,
}: BranchPopoverProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay one frame so the opening click doesn't immediately close
    const raf = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handleClick);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  const dirBtnCls = (active: boolean) =>
    `${BTN_BASE} rounded ${active ? BTN_ACTIVE : BTN_INACTIVE}`;
  const lineBtnCls = (active: boolean) =>
    `${BTN_BASE} rounded flex-1 ${active ? BTN_ACTIVE : BTN_INACTIVE}`;

  return (
    <div
      ref={ref}
      className="absolute bottom-0 left-10 z-50 w-44 rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg dark:border-gray-600 dark:bg-[#2b2f36]"
    >
      {/* Structure */}
      <div className="mb-2">
        <div className="mb-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
          {t("docs.structure")}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className={dirBtnCls(direction === 0)}
            title={t("docs.layoutLeft")}
            onClick={() => onDirection(0)}
          >
            <LayoutLeftIcon />
          </button>
          <button
            type="button"
            className={dirBtnCls(direction === 1)}
            title={t("docs.layoutRight")}
            onClick={() => onDirection(1)}
          >
            <LayoutRightIcon />
          </button>
          <button
            type="button"
            className={dirBtnCls(direction === 2)}
            title={t("docs.layoutSide")}
            onClick={() => onDirection(2)}
          >
            <LayoutSideIcon />
          </button>
        </div>
      </div>

      {/* Line style */}
      <div>
        <div className="mb-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
          {t("docs.branchLine")}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className={lineBtnCls(lineStyle === "curved")}
            title={t("docs.curved")}
            onClick={() => onLineStyle("curved")}
          >
            <CurvedLineIcon />
          </button>
          <button
            type="button"
            className={lineBtnCls(lineStyle === "angular")}
            title={t("docs.angular")}
            onClick={() => onLineStyle("angular")}
          >
            <AngularLineIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Toolbar Component ─────────────────────────────────────────────────

export function MindBottomToolbar({ mind }: MindBottomToolbarProps) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(100);
  const [showBranch, setShowBranch] = useState(false);
  const [direction, setDirection] = useState<Direction>(2);
  const [lineStyle, setLineStyle] = useState<LineStyle>("curved");

  // Sync direction from mind instance
  useEffect(() => {
    if (mind) {
      setDirection((mind.direction as Direction) ?? 2);
    }
  }, [mind]);

  // Listen to scale events
  useEffect(() => {
    if (!mind) return;
    setZoom(Math.round(mind.scaleVal * 100));
    const handler = (val: number) => setZoom(Math.round(val * 100));
    mind.bus.addListener("scale", handler);
    return () => mind.bus.removeListener("scale", handler);
  }, [mind]);

  const handleUndo = useCallback(() => mind?.undo(), [mind]);
  const handleRedo = useCallback(() => mind?.redo(), [mind]);

  const handleZoomIn = useCallback(() => {
    if (!mind) return;
    const next = Math.min(
      mind.scaleVal + (mind.scaleSensitivity ?? 0.1),
      mind.scaleMax ?? 1.4,
    );
    mind.scale(next);
  }, [mind]);

  const handleZoomOut = useCallback(() => {
    if (!mind) return;
    const next = Math.max(
      mind.scaleVal - (mind.scaleSensitivity ?? 0.1),
      mind.scaleMin ?? 0.2,
    );
    mind.scale(next);
  }, [mind]);

  const handleResetZoom = useCallback(() => mind?.scale(1), [mind]);

  const handleDirection = useCallback(
    (dir: Direction) => {
      if (!mind) return;
      if (dir === 0) mind.initLeft();
      else if (dir === 1) mind.initRight();
      else mind.initSide();
      setDirection(dir);
    },
    [mind],
  );

  const handleLineStyle = useCallback(
    (style: LineStyle) => {
      if (!mind) return;
      setLineStyle(style);
      if (style === "angular") {
        mind.generateMainBranch = angularMain;
        mind.generateSubBranch = angularSub;
      } else {
        mind.generateMainBranch = curvedMain;
        mind.generateSubBranch = curvedSub;
      }
      mind.linkDiv();
    },
    [mind],
  );

  const toggleBranch = useCallback(() => setShowBranch((v) => !v), []);
  const closeBranch = useCallback(() => setShowBranch(false), []);

  if (!mind) return null;

  return (
    <div className="absolute bottom-3 left-3 z-50 flex flex-col items-stretch">
      {/* Branch popover */}
      {showBranch && (
        <BranchPopover
          direction={direction}
          lineStyle={lineStyle}
          onDirection={handleDirection}
          onLineStyle={handleLineStyle}
          onClose={closeBranch}
        />
      )}

      {/* Toolbar pill */}
      <div className="flex w-8 flex-col items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-[#2b2f36]">
        {/* Undo */}
        <button
          type="button"
          className={`${BTN_BASE} ${BTN_INACTIVE}`}
          title={t("docs.undo")}
          onClick={handleUndo}
        >
          <UndoIcon />
        </button>

        {/* Redo */}
        <button
          type="button"
          className={`${BTN_BASE} ${BTN_INACTIVE}`}
          title={t("docs.redo")}
          onClick={handleRedo}
        >
          <RedoIcon />
        </button>

        <div className={DIVIDER} style={{ height: 1 }} />

        {/* Branch display */}
        <button
          type="button"
          className={`${BTN_BASE} ${showBranch ? BTN_ACTIVE : BTN_INACTIVE}`}
          title={t("docs.branchDisplay")}
          onClick={toggleBranch}
        >
          <BranchDisplayIcon />
        </button>

        <div className={DIVIDER} style={{ height: 1 }} />

        {/* Zoom percentage */}
        <button
          type="button"
          className={`${BTN_BASE} ${BTN_INACTIVE} text-[10px] font-medium leading-none`}
          title={t("docs.resetZoom")}
          onClick={handleResetZoom}
        >
          {zoom}%
        </button>

        {/* Zoom out */}
        <button
          type="button"
          className={`${BTN_BASE} ${BTN_INACTIVE}`}
          title={t("docs.zoomOut")}
          onClick={handleZoomOut}
        >
          <ZoomOutIcon />
        </button>

        {/* Zoom in */}
        <button
          type="button"
          className={`${BTN_BASE} ${BTN_INACTIVE}`}
          title={t("docs.zoomIn")}
          onClick={handleZoomIn}
        >
          <ZoomInIcon />
        </button>
      </div>
    </div>
  );
}
