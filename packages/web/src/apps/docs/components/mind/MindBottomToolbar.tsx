/**
 * Feishu-inspired bottom-left toolbar for the mind map editor.
 *
 * Provides undo/redo, branch display (structure + line style), zoom,
 * fullscreen, and re-center. Button style matches the top-left view switcher.
 */

import type { MindElixirInstance } from "mind-elixir";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useThemeCore, useWindowActions } from "@/system";
import { useWindowId } from "@/system/window/WindowNavContext";
import {
  angularMain,
  angularSub,
  curvedMain,
  curvedSub,
} from "./mind-branch-styles";
import {
  AngularLinePreview,
  BranchDisplayIcon,
  CurvedLinePreview,
  FitToScreenIcon,
  FullscreenIcon,
  MindmapDownIcon,
  MindmapLeftIcon,
  MindmapRightIcon,
  MindmapSideIcon,
  RedoIcon,
  UndoIcon,
  ZoomIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./mind-toolbar-icons";

// ── Types ───────────────────────────────────────────────────────────────────

type Direction = 0 | 1 | 2 | 3;
type LineStyle = "curved" | "angular";

interface MindBottomToolbarProps {
  mind: MindElixirInstance | null;
}

// ── Style constants (matching MindViewSwitcher top-left style) ──────────────

const BTN =
  "cursor-pointer p-1.5 transition-colors flex items-center justify-center";
const BTN_CLR =
  "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300";
const BTN_ACTIVE =
  "bg-[var(--accent-subtle)]0/20 text-[var(--accent)] dark:bg-[var(--accent-subtle)]0/25 dark:text-[var(--accent)]";
const BTN_DISABLED = "text-gray-300 dark:text-gray-600 cursor-default";
const SEL =
  "bg-[var(--accent-subtle)]0/20 text-[var(--accent)] dark:bg-[var(--accent-subtle)]0/25 dark:text-[var(--accent)]";
const UNSEL =
  "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300";

// ── Portal Popover (escapes overflow:hidden containers) ─────────────────────

interface PortalPopoverProps {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function PortalPopover({
  anchorRef,
  children,
  onMouseEnter,
  onMouseLeave,
}: PortalPopoverProps) {
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ left: rect.right, bottom: window.innerHeight - rect.bottom });
  }, [anchorRef]);

  if (!pos) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover bridge for portal popover
    <div
      style={{
        position: "fixed",
        left: pos.left,
        bottom: pos.bottom,
        zIndex: 9999,
        paddingLeft: 8,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}

// ── Branch Display Popover ──────────────────────────────────────────────────

interface BranchPopoverProps {
  direction: Direction;
  lineStyle: LineStyle;
  onDirection: (dir: Direction) => void;
  onLineStyle: (style: LineStyle) => void;
}

const STRUCTURES: Array<{
  dir: Direction;
  key: string;
  Icon: () => React.JSX.Element;
  disabled?: boolean;
}> = [
  { dir: 1, key: "layoutRight", Icon: MindmapRightIcon },
  { dir: 0, key: "layoutLeft", Icon: MindmapLeftIcon },
  { dir: 2, key: "layoutSide", Icon: MindmapSideIcon },
  { dir: 3, key: "layoutDown", Icon: MindmapDownIcon },
];

function BranchPopover({
  direction,
  lineStyle,
  onDirection,
  onLineStyle,
}: BranchPopoverProps) {
  const { t } = useTranslation();

  const structBtnCls = (active: boolean, disabled?: boolean) =>
    `flex h-8 flex-1 cursor-pointer items-center justify-center rounded transition-colors duration-150 ${
      disabled ? BTN_DISABLED : active ? SEL : UNSEL
    }`;

  const lineBtnCls = (active: boolean) =>
    `flex h-8 flex-1 cursor-pointer items-center justify-center rounded transition-colors duration-150 ${active ? SEL : UNSEL}`;

  return (
    <div className="w-[240px] rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg dark:border-gray-600 dark:bg-[#2b2f36]">
      {/* Structure */}
      <div className="mb-2">
        <div className="mb-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
          {t("docs.structure")}
        </div>
        <div className="flex gap-1">
          {STRUCTURES.map(({ dir, key, Icon, disabled }) => (
            <button
              key={dir}
              type="button"
              className={structBtnCls(direction === dir, disabled)}
              title={disabled ? t("docs.notSupported") : t(`docs.${key}`)}
              onClick={() => !disabled && onDirection(dir)}
            >
              <Icon />
            </button>
          ))}
        </div>
      </div>

      {/* Branch lines */}
      <div>
        <div className="mb-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
          {t("docs.branchLine")}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className={lineBtnCls(lineStyle === "angular")}
            title={t("docs.angular")}
            onClick={() => onLineStyle("angular")}
          >
            <AngularLinePreview />
          </button>
          <button
            type="button"
            className={lineBtnCls(lineStyle === "curved")}
            title={t("docs.curved")}
            onClick={() => onLineStyle("curved")}
          >
            <CurvedLinePreview />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Toolbar Component ──────────────────────────────────────────────────

export function MindBottomToolbar({ mind }: MindBottomToolbarProps) {
  const { t } = useTranslation();
  const { theme } = useThemeCore();
  const { toggleFullscreen } = useWindowActions();
  const windowId = useWindowId();
  const isDark = theme === "dark";

  const [zoom, setZoom] = useState(100);
  const [showBranch, setShowBranch] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const [direction, setDirection] = useState<Direction>(2);
  const [lineStyle, setLineStyle] = useState<LineStyle>("angular");

  const branchRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const branchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const fullscreenDataRef = useRef<{
    mapCenterX: number;
    mapCenterY: number;
  } | null>(null);

  // Delayed hover helpers — allow mouse travel from button to popover
  const openBranch = useCallback(() => {
    if (branchTimerRef.current) clearTimeout(branchTimerRef.current);
    setShowBranch(true);
  }, []);
  const closeBranch = useCallback(() => {
    branchTimerRef.current = setTimeout(() => setShowBranch(false), 200);
  }, []);
  const openZoom = useCallback(() => {
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    setShowZoom(true);
  }, []);
  const closeZoom = useCallback(() => {
    zoomTimerRef.current = setTimeout(() => setShowZoom(false), 200);
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (branchTimerRef.current) clearTimeout(branchTimerRef.current);
      if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    };
  }, []);

  // Sync direction from mind instance
  useEffect(() => {
    if (mind) setDirection((mind.direction as Direction) ?? 2);
  }, [mind]);

  // Apply default angular line style on init
  useEffect(() => {
    if (!mind) return;
    mind.generateMainBranch = angularMain;
    mind.generateSubBranch = angularSub;
    mind.linkDiv();
  }, [mind]);

  // Listen to scale events
  useEffect(() => {
    if (!mind) return;
    setZoom(Math.round(mind.scaleVal * 100));
    const handler = (val: number) => setZoom(Math.round(val * 100));
    mind.bus.addListener("scale", handler);
    return () => mind.bus?.removeListener("scale", handler);
  }, [mind]);

  // Re-center map when container resizes (handles app-level fullscreen transitions)
  useEffect(() => {
    if (!mind) return;
    const fsContainer = mind.container.closest(".mind-feishu") as
      | HTMLElement
      | undefined;
    if (!fsContainer) return;
    const observer = new ResizeObserver(() => {
      const data = fullscreenDataRef.current;
      if (!data) return;
      const rect = mind.container.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const tx = cx - data.mapCenterX * mind.scaleVal;
      const ty = cy - data.mapCenterY * mind.scaleVal;
      const style = mind.map.style.transform;
      const m = style.match(/translate\((.+?)px,\s*(.+?)px\)/);
      if (m) {
        mind.move(tx - Number(m[1]), ty - Number(m[2]));
      }
    });
    observer.observe(fsContainer);
    return () => observer.disconnect();
  }, [mind]);

  const handleUndo = useCallback(() => mind?.undo(), [mind]);
  const handleRedo = useCallback(() => mind?.redo(), [mind]);

  const handleZoomIn = useCallback(() => {
    if (!mind) return;
    mind.scale(
      Math.min(
        mind.scaleVal + (mind.scaleSensitivity ?? 0.1),
        mind.scaleMax ?? 1.4,
      ),
    );
  }, [mind]);

  const handleZoomOut = useCallback(() => {
    if (!mind) return;
    mind.scale(
      Math.max(
        mind.scaleVal - (mind.scaleSensitivity ?? 0.1),
        mind.scaleMin ?? 0.2,
      ),
    );
  }, [mind]);

  const handleFitToScreen = useCallback(() => mind?.toCenter(), [mind]);

  const handleFullscreen = useCallback(() => {
    if (!mind || !windowId) return;
    // Record current state for repositioning after fullscreen change
    const rect = mind.container.getBoundingClientRect();
    const style = mind.map.style.transform;
    const m = style.match(/translate\((.+?)px,\s*(.+?)px\)/);
    const curX = m ? Number(m[1]) : 0;
    const curY = m ? Number(m[2]) : 0;
    fullscreenDataRef.current = {
      mapCenterX: (rect.width / 2 - curX) / mind.scaleVal,
      mapCenterY: (rect.height / 2 - curY) / mind.scaleVal,
    };
    toggleFullscreen(windowId);
  }, [mind, windowId, toggleFullscreen]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      mind?.scale(Number(e.target.value) / 100);
    },
    [mind],
  );

  const handleDirection = useCallback(
    (dir: Direction) => {
      if (!mind) return;
      mind.container.classList.remove("mind-down");
      if (dir === 0) mind.initLeft();
      else if (dir === 1) mind.initRight();
      else if (dir === 2) mind.initSide();
      else {
        mind.direction = 3 as never;
        mind.container.classList.add("mind-down");
        mind.refresh();
        mind.toCenter();
      }
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

  if (!mind) return null;

  const sliderPct = ((zoom - 20) / 120) * 100;
  const trackBg = isDark ? "#4b5563" : "#DEE0E3";

  return (
    <div className="absolute bottom-3 left-3 z-50">
      {/* Main pill — matches top-left MindViewSwitcher w-8 style */}
      <div className="flex w-8 flex-col items-stretch rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-[#2b2f36]">
        {/* Undo */}
        <button
          type="button"
          className={`${BTN} ${BTN_CLR} rounded-t-[7px]`}
          title={`${t("docs.undo")} (Ctrl+Z)`}
          onClick={handleUndo}
        >
          <UndoIcon />
        </button>

        {/* Redo */}
        <button
          type="button"
          className={`${BTN} ${BTN_CLR}`}
          title={`${t("docs.redo")} (Ctrl+Shift+Z)`}
          onClick={handleRedo}
        >
          <RedoIcon />
        </button>

        {/* Branch display — hover to show popover */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: hover zone for branch popover */}
        <div
          ref={branchRef}
          className="relative"
          onMouseEnter={openBranch}
          onMouseLeave={closeBranch}
        >
          <button
            type="button"
            className={`${BTN} ${showBranch ? BTN_ACTIVE : BTN_CLR}`}
            title={t("docs.branchDisplay")}
          >
            <BranchDisplayIcon />
          </button>
          {showBranch &&
            createPortal(
              <PortalPopover
                anchorRef={branchRef}
                onMouseEnter={openBranch}
                onMouseLeave={closeBranch}
              >
                <BranchPopover
                  direction={direction}
                  lineStyle={lineStyle}
                  onDirection={handleDirection}
                  onLineStyle={handleLineStyle}
                />
              </PortalPopover>,
              document.body,
            )}
        </div>

        {/* Fullscreen */}
        <button
          type="button"
          className={`${BTN} ${BTN_CLR}`}
          title={t("docs.fullscreen")}
          onClick={handleFullscreen}
        >
          <FullscreenIcon />
        </button>

        {/* Zoom — hover to expand slider */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: hover zone for zoom slider */}
        <div
          ref={zoomRef}
          className="relative"
          onMouseEnter={openZoom}
          onMouseLeave={closeZoom}
        >
          <button
            type="button"
            className={`${BTN} ${BTN_CLR} rounded-b-[7px]`}
            title={`${zoom}%`}
            onClick={() => mind.scale(1)}
          >
            <ZoomIcon />
          </button>

          {showZoom &&
            createPortal(
              <PortalPopover
                anchorRef={zoomRef}
                onMouseEnter={openZoom}
                onMouseLeave={closeZoom}
              >
                <div className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-1.5 shadow-sm dark:border-gray-600 dark:bg-[#2b2f36]">
                  <button
                    type="button"
                    className={`${BTN_CLR} flex cursor-pointer items-center justify-center rounded p-1 transition-colors duration-150`}
                    title={t("docs.zoomOut")}
                    onClick={handleZoomOut}
                  >
                    <ZoomOutIcon />
                  </button>
                  <input
                    type="range"
                    min={20}
                    max={140}
                    value={zoom}
                    onChange={handleSliderChange}
                    className="h-0.5 w-[100px] cursor-pointer appearance-none rounded-full outline-none [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#3370FF] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3370FF]"
                    style={{
                      background: `linear-gradient(to right, #3370FF ${sliderPct}%, ${trackBg} ${sliderPct}%)`,
                    }}
                  />
                  <button
                    type="button"
                    className={`${BTN_CLR} flex cursor-pointer items-center justify-center rounded p-1 transition-colors duration-150`}
                    title={t("docs.zoomIn")}
                    onClick={handleZoomIn}
                  >
                    <ZoomInIcon />
                  </button>
                  <button
                    type="button"
                    className={`${BTN_CLR} flex cursor-pointer items-center justify-center rounded p-1 transition-colors duration-150`}
                    title={t("docs.fitToScreen")}
                    onClick={handleFitToScreen}
                  >
                    <FitToScreenIcon />
                  </button>
                </div>
              </PortalPopover>,
              document.body,
            )}
        </div>
      </div>
    </div>
  );
}
