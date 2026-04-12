/**
 * Feishu-inspired bottom-left toolbar for the mind map editor.
 *
 * Provides undo/redo, branch display (structure + line style), and zoom.
 * Design matches Feishu's mind map toolbar exactly.
 */

import type { MindElixirInstance } from "mind-elixir";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useThemeCore } from "@/system";
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
  MindmapDownIcon,
  MindmapLeftIcon,
  MindmapRightIcon,
  MindmapSideIcon,
  RedoIcon,
  UndoIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./mind-toolbar-icons";

// ── Types ───────────────────────────────────────────────────────────────────

type Direction = 0 | 1 | 2 | 3;
type LineStyle = "curved" | "angular";

interface MindBottomToolbarProps {
  mind: MindElixirInstance | null;
}

// ── Style constants ─────────────────────────────────────────────────────────

const BTN =
  "flex h-9 w-12 cursor-pointer items-center justify-center transition-colors duration-150";
const BTN_CLR =
  "text-[#1F2329] hover:bg-[rgba(31,35,41,0.08)] dark:text-gray-300 dark:hover:bg-white/8";
const BTN_DISABLED = "text-[#bcc0c7] dark:text-gray-600 cursor-default";
const SEL =
  "bg-[rgba(51,112,255,0.1)] text-[#3370FF] dark:bg-[rgba(51,112,255,0.15)]";
const UNSEL =
  "text-[#1F2329] hover:bg-[rgba(31,35,41,0.08)] dark:text-gray-300 dark:hover:bg-white/8";

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
  { dir: 3, key: "layoutDown", Icon: MindmapDownIcon, disabled: true },
];

function BranchPopover({
  direction,
  lineStyle,
  onDirection,
  onLineStyle,
}: BranchPopoverProps) {
  const { t } = useTranslation();

  const structBtnCls = (active: boolean, disabled?: boolean) =>
    `flex h-9 flex-1 cursor-pointer items-center justify-center rounded transition-colors duration-150 ${
      disabled ? BTN_DISABLED : active ? SEL : UNSEL
    }`;

  const lineBtnCls = (active: boolean) =>
    `flex h-9 flex-1 cursor-pointer items-center justify-center rounded transition-colors duration-150 ${active ? SEL : UNSEL}`;

  return (
    <div
      className="w-[254px] rounded-md border border-[#DEE0E3] bg-white dark:border-gray-600 dark:bg-[#2b2f36]"
      style={{
        padding: "13px 12px 11px 13px",
        boxShadow: "0 4px 8px rgba(31,35,41,0.1)",
      }}
    >
      {/* Structure */}
      <div className="mb-2.5">
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
  const isDark = theme === "dark";

  const [zoom, setZoom] = useState(100);
  const [showBranch, setShowBranch] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const [direction, setDirection] = useState<Direction>(2);
  const [lineStyle, setLineStyle] = useState<LineStyle>("angular");

  const branchRef = useRef<HTMLDivElement>(null);

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
    return () => mind.bus.removeListener("scale", handler);
  }, [mind]);

  // Outside-click to close branch popover
  useEffect(() => {
    if (!showBranch) return;
    function handleClick(e: MouseEvent) {
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) {
        setShowBranch(false);
      }
    }
    const raf = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handleClick);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [showBranch]);

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

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      mind?.scale(Number(e.target.value) / 100);
    },
    [mind],
  );

  const handleDirection = useCallback(
    (dir: Direction) => {
      if (!mind || dir === 3) return;
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

  if (!mind) return null;

  const sliderPct = ((zoom - 20) / 120) * 100;
  const trackBg = isDark ? "#4b5563" : "#DEE0E3";

  return (
    <div className="absolute bottom-3 left-3 z-50">
      {/* Main pill */}
      <div
        className="flex flex-col rounded-lg border border-[#DEE0E3] bg-white dark:border-gray-600 dark:bg-[#2b2f36]"
        style={{ boxShadow: "0 2px 8px rgba(31,35,41,0.06)" }}
      >
        {/* Undo */}
        <button
          type="button"
          className={`${BTN} ${BTN_CLR} rounded-t-lg`}
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

        {/* Branch display */}
        <div ref={branchRef} className="relative">
          <button
            type="button"
            className={`${BTN} ${showBranch ? SEL : BTN_CLR}`}
            title={t("docs.branchDisplay")}
            onClick={() => setShowBranch((v) => !v)}
          >
            <BranchDisplayIcon />
          </button>
          {showBranch && (
            <div className="absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2">
              <BranchPopover
                direction={direction}
                lineStyle={lineStyle}
                onDirection={handleDirection}
                onLineStyle={handleLineStyle}
              />
            </div>
          )}
        </div>

        {/* Zoom */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: hover zone wrapper for zoom slider */}
        <div
          className="relative"
          onMouseEnter={() => setShowZoom(true)}
          onMouseLeave={() => setShowZoom(false)}
        >
          <button
            type="button"
            className={`${BTN} ${BTN_CLR} rounded-b-lg text-[11px] font-medium`}
            title={t("docs.resetZoom")}
            onClick={() => mind.scale(1)}
          >
            {zoom}%
          </button>

          {/* Zoom slider panel — bridge div starts at left:100% for seamless hover */}
          <div
            className={`absolute left-full top-0 transition-opacity duration-150 ease-in-out ${showZoom ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <div
              className="ml-2 flex h-9 items-center gap-2 rounded-lg border border-[#DEE0E3] bg-white px-2 dark:border-gray-600 dark:bg-[#2b2f36]"
              style={{ boxShadow: "0 2px 8px rgba(31,35,41,0.06)" }}
            >
              <button
                type="button"
                className={`${BTN_CLR} flex cursor-pointer items-center justify-center rounded p-1 transition-colors duration-150 hover:bg-[rgba(31,35,41,0.08)] dark:hover:bg-white/8`}
                title={t("docs.fitToScreen")}
                onClick={handleFitToScreen}
              >
                <FitToScreenIcon />
              </button>
              <button
                type="button"
                className={`${BTN_CLR} flex cursor-pointer items-center justify-center rounded p-1 transition-colors duration-150 hover:bg-[rgba(31,35,41,0.08)] dark:hover:bg-white/8`}
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
                className="h-0.5 w-[120px] cursor-pointer appearance-none rounded-full outline-none [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#3370FF] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3370FF]"
                style={{
                  background: `linear-gradient(to right, #3370FF ${sliderPct}%, ${trackBg} ${sliderPct}%)`,
                }}
              />
              <button
                type="button"
                className={`${BTN_CLR} flex cursor-pointer items-center justify-center rounded p-1 transition-colors duration-150 hover:bg-[rgba(31,35,41,0.08)] dark:hover:bg-white/8`}
                title={t("docs.zoomIn")}
                onClick={handleZoomIn}
              >
                <ZoomInIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
