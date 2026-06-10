import { cn } from "@tokimo/ui";
import {
  BarChart3,
  Film,
  Image as ImageIcon,
  MessageSquare,
  Minus,
  Paintbrush,
  Pentagon,
  Redo2,
  Sparkles,
  Table2,
  Type,
  Undo2,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { HamburgerMenu } from "./components/HamburgerMenu";
import type { ShapeLibraryItem } from "./lib/shape-library";
import { SHAPE_LIBRARY } from "./lib/shape-library";
import type { SlideLineElement, SlideShapeElement } from "./types";
import {
  createAudioElement,
  createChartElement,
  createLatexElement,
  createTableElement,
  createTextElement,
  createVideoElement,
  generateId,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from "./types";
import { useSlideStore } from "./use-slide-store";

export function SlideToolbar() {
  const addElement = useSlideStore((s) => s.addElement);
  const undo = useSlideStore((s) => s.undo);
  const redo = useSlideStore((s) => s.redo);
  const historyIndex = useSlideStore((s) => s.historyIndex);
  const formatPainterMode = useSlideStore((s) => s.formatPainterMode);
  const activateFormatPainter = useSlideStore((s) => s.activateFormatPainter);
  const deactivateFormatPainter = useSlideStore(
    (s) => s.deactivateFormatPainter,
  );
  const panelTab = useSlideStore((s) => s.panelTab);
  const setPanelTab = useSlideStore((s) => s.setPanelTab);

  const [textMenuOpen, setTextMenuOpen] = useState(false);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [chartMenuOpen, setChartMenuOpen] = useState(false);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const [lineMenuOpen, setLineMenuOpen] = useState(false);
  const [tableHover, setTableHover] = useState<{
    row: number;
    col: number;
  }>({ row: 0, col: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fpClickTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const handleAddText = useCallback(
    (textType: "title" | "subtitle" | "body" | "heading" | "small") => {
      addElement(createTextElement(textType));
      setTextMenuOpen(false);
    },
    [addElement],
  );

  const handleAddShape = useCallback(
    (shape: ShapeLibraryItem) => {
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

  const handleAddLine = useCallback(
    (lineType: "straight" | "polyline" | "curve") => {
      const midX = VIEWPORT_WIDTH / 2;
      const midY = VIEWPORT_HEIGHT / 2;
      const controlPoints: [number, number][] =
        lineType === "polyline"
          ? [[midX, midY - 50]]
          : lineType === "curve"
            ? [[midX, midY - 80]]
            : [];
      const el: SlideLineElement = {
        id: generateId(),
        type: "line",
        left: midX - 100,
        top: midY,
        width: 200,
        start: [0, 50],
        end: [200, 50],
        style: "solid",
        color: "#333333",
        strokeWidth: 2,
        points: ["", "arrow"],
        lineType,
        controlPoints,
      };
      addElement(el);
      setLineMenuOpen(false);
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
    setChartMenuOpen(false);
    setMediaMenuOpen(false);
    setTableMenuOpen(false);
    setLineMenuOpen(false);
  }, []);

  const itemClass = (active: boolean) =>
    cn(
      "flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1.5 min-w-[44px]",
      "hover:bg-black/5 dark:hover:bg-white/5",
      active &&
        "bg-[var(--accent-subtle)] text-[var(--accent)] dark:bg-[var(--accent-subtle)]0/10",
    );

  const handleAddTable = useCallback(
    (rows: number, cols: number) => {
      addElement(createTableElement(rows, cols));
      setTableMenuOpen(false);
    },
    [addElement],
  );

  return (
    <div className="flex items-center gap-0.5 py-1">
      <HamburgerMenu />
      <div className="mx-1.5 h-5 w-px bg-border-subtle" />

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

      {/* Format Painter */}
      <button
        type="button"
        className={cn(
          "cursor-pointer rounded p-1.5 hover:bg-black/5 dark:hover:bg-white/5",
          formatPainterMode !== "off" &&
            "bg-[var(--accent-subtle)] text-[var(--accent)] dark:bg-[var(--accent-subtle)]0/10",
        )}
        title={
          formatPainterMode === "persistent"
            ? "格式刷 (持续模式，按 Esc 退出)"
            : formatPainterMode === "single"
              ? "格式刷 (单次模式)"
              : "格式刷 (单击: 单次, 双击: 持续)"
        }
        onClick={() => {
          if (formatPainterMode !== "off") {
            deactivateFormatPainter();
            return;
          }
          if (fpClickTimer.current) {
            clearTimeout(fpClickTimer.current);
            fpClickTimer.current = null;
            activateFormatPainter("persistent");
          } else {
            fpClickTimer.current = setTimeout(() => {
              fpClickTimer.current = null;
              activateFormatPainter("single");
            }, 250);
          }
        }}
      >
        <Paintbrush size={16} />
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
            setChartMenuOpen(false);
            setMediaMenuOpen(false);
            setTableMenuOpen(false);
            setLineMenuOpen(false);
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
            setChartMenuOpen(false);
            setMediaMenuOpen(false);
            setTableMenuOpen(false);
            setLineMenuOpen(false);
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
            <div className="absolute left-0 top-full z-50 mt-1 w-[320px] rounded-md border border-border-subtle bg-white shadow-lg dark:bg-neutral-800">
              <div className="max-h-[400px] overflow-y-auto p-2">
                {SHAPE_LIBRARY.map((category) => (
                  <div key={category.id} className="mb-2 last:mb-0">
                    <div className="mb-1 px-1 text-[11px] font-medium text-fg-muted">
                      {category.name}
                    </div>
                    <div className="grid grid-cols-8 gap-0.5">
                      {category.shapes.map((shape) => (
                        <button
                          key={shape.id}
                          type="button"
                          className="flex cursor-pointer items-center justify-center rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/5"
                          title={shape.name}
                          onClick={() => handleAddShape(shape)}
                        >
                          <svg
                            width="32"
                            height="32"
                            viewBox={`0 0 ${shape.viewBox[0]} ${shape.viewBox[1]}`}
                          >
                            <path d={shape.path} fill="#666" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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

      {/* 媒体 dropdown */}
      <div className="relative">
        <button
          type="button"
          className={itemClass(mediaMenuOpen)}
          onClick={() => {
            setMediaMenuOpen(!mediaMenuOpen);
            setTextMenuOpen(false);
            setShapeMenuOpen(false);
            setChartMenuOpen(false);
            setTableMenuOpen(false);
            setLineMenuOpen(false);
          }}
        >
          <Film size={18} />
          <span className="text-[11px] leading-tight">媒体</span>
        </button>
        {mediaMenuOpen && (
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: no keyboard interaction needed */}
            <div className="fixed inset-0 z-40" onClick={closeAllMenus} />
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[120px] rounded-md border border-border-subtle bg-white py-1 shadow-lg dark:bg-neutral-800">
              <button
                type="button"
                className="block w-full cursor-pointer px-3 py-1.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => {
                  addElement(createVideoElement());
                  setMediaMenuOpen(false);
                }}
              >
                视频
              </button>
              <button
                type="button"
                className="block w-full cursor-pointer px-3 py-1.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => {
                  addElement(createAudioElement());
                  setMediaMenuOpen(false);
                }}
              >
                音频
              </button>
            </div>
          </>
        )}
      </div>

      {/* 图表 dropdown */}
      <div className="relative">
        <button
          type="button"
          className={itemClass(chartMenuOpen)}
          onClick={() => {
            setChartMenuOpen(!chartMenuOpen);
            setTextMenuOpen(false);
            setShapeMenuOpen(false);
            setMediaMenuOpen(false);
            setTableMenuOpen(false);
            setLineMenuOpen(false);
          }}
        >
          <BarChart3 size={18} />
          <span className="text-[11px] leading-tight">图表</span>
        </button>
        {chartMenuOpen && (
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: no keyboard interaction needed */}
            <div className="fixed inset-0 z-40" onClick={closeAllMenus} />
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[120px] rounded-md border border-border-subtle bg-white py-1 shadow-lg dark:bg-neutral-800">
              {(
                [
                  ["bar", "柱状图"],
                  ["column", "条形图"],
                  ["line", "折线图"],
                  ["area", "面积图"],
                  ["scatter", "散点图"],
                  ["pie", "饼图"],
                  ["doughnut", "环形图"],
                  ["radar", "雷达图"],
                ] as const
              ).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  className="block w-full cursor-pointer px-3 py-1.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5"
                  onClick={() => {
                    addElement(createChartElement(type));
                    setChartMenuOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 公式 */}
      <button
        type="button"
        className={itemClass(false)}
        onClick={() => {
          closeAllMenus();
          addElement(createLatexElement());
        }}
        title="插入公式"
      >
        <span className="font-serif text-base italic leading-none">Σ</span>
        <span className="text-[11px] leading-tight">公式</span>
      </button>

      {/* 表格 dropdown */}
      <div className="relative">
        <button
          type="button"
          className={itemClass(tableMenuOpen)}
          onClick={() => {
            setTableMenuOpen(!tableMenuOpen);
            setTextMenuOpen(false);
            setShapeMenuOpen(false);
            setChartMenuOpen(false);
            setMediaMenuOpen(false);
            setLineMenuOpen(false);
          }}
        >
          <Table2 size={18} />
          <span className="text-[11px] leading-tight">表格</span>
        </button>
        {tableMenuOpen && (
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: no keyboard interaction needed */}
            <div className="fixed inset-0 z-40" onClick={closeAllMenus} />
            <div className="absolute left-0 top-full z-50 mt-1 w-fit rounded-md border border-border-subtle bg-white p-2 shadow-lg dark:bg-neutral-800">
              <div className="mb-1 text-center text-xs text-fg-muted">
                {tableHover.row > 0
                  ? `${tableHover.row} × ${tableHover.col}`
                  : "选择大小"}
              </div>
              <div className="grid w-[108px] grid-cols-6 gap-0.5">
                {Array.from({ length: 36 }, (_, idx) => {
                  const r = Math.floor(idx / 6);
                  const c = idx % 6;
                  return (
                    <button
                      key={`table-${r}-${c}`}
                      type="button"
                      className="h-4 w-4 cursor-pointer rounded-sm border border-neutral-300 dark:border-neutral-600"
                      style={{
                        backgroundColor:
                          r < tableHover.row && c < tableHover.col
                            ? "#4472C4"
                            : undefined,
                      }}
                      onMouseEnter={() =>
                        setTableHover({ row: r + 1, col: c + 1 })
                      }
                      onMouseLeave={() => setTableHover({ row: 0, col: 0 })}
                      onClick={() => handleAddTable(r + 1, c + 1)}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 线条 */}
      <div className="relative">
        <button
          type="button"
          className={itemClass(lineMenuOpen)}
          onClick={() => {
            setLineMenuOpen(!lineMenuOpen);
            setTextMenuOpen(false);
            setShapeMenuOpen(false);
            setChartMenuOpen(false);
            setMediaMenuOpen(false);
            setTableMenuOpen(false);
          }}
        >
          <Minus size={18} />
          <span className="text-[11px] leading-tight">线条</span>
        </button>
        {lineMenuOpen && (
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: no keyboard interaction needed */}
            <div className="fixed inset-0 z-40" onClick={closeAllMenus} />
            <div className="absolute left-0 top-full z-50 mt-1 w-36 rounded-md border border-border-subtle bg-white shadow-lg dark:bg-neutral-800">
              <div className="p-1">
                {(
                  [
                    ["straight", "直线"],
                    ["polyline", "折线"],
                    ["curve", "曲线"],
                  ] as const
                ).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
                    onClick={() => handleAddLine(type)}
                  >
                    <svg width="24" height="14" viewBox="0 0 24 14">
                      {type === "straight" && (
                        <line
                          x1="2"
                          y1="12"
                          x2="22"
                          y2="2"
                          stroke="#666"
                          strokeWidth="2"
                        />
                      )}
                      {type === "polyline" && (
                        <polyline
                          points="2,12 12,2 22,12"
                          fill="none"
                          stroke="#666"
                          strokeWidth="2"
                        />
                      )}
                      {type === "curve" && (
                        <path
                          d="M2,12 Q12,-2 22,12"
                          fill="none"
                          stroke="#666"
                          strokeWidth="2"
                        />
                      )}
                    </svg>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 动画 */}
      <button
        type="button"
        className={itemClass(panelTab === "animation")}
        onClick={() =>
          setPanelTab(panelTab === "animation" ? null : "animation")
        }
      >
        <Sparkles size={18} />
        <span className="text-[11px] leading-tight">动画</span>
      </button>

      {/* 评论 */}
      <button
        type="button"
        className={itemClass(panelTab === "comment")}
        onClick={() => setPanelTab(panelTab === "comment" ? null : "comment")}
      >
        <MessageSquare size={18} />
        <span className="text-[11px] leading-tight">评论</span>
      </button>
    </div>
  );
}
