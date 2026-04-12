import { useCallback, useState } from "react";
import { SLIDE_LAYOUTS } from "../lib/layouts";
import type { SlideBackground } from "../types";
import { useSlideStore } from "../use-slide-store";
import { PanelTabs } from "./PanelTabs";
import { TransitionPanel } from "./TransitionPanel";

const TABS = [
  { key: "design", label: "设计" },
  { key: "transition", label: "切换" },
  { key: "animation", label: "动画" },
];

function DesignTab() {
  const currentSlide = useSlideStore((s) => s.currentSlide());
  const updateSlideBackground = useSlideStore((s) => s.updateSlideBackground);
  const applyBackgroundToAll = useSlideStore((s) => s.applyBackgroundToAll);
  const applyLayout = useSlideStore((s) => s.applyLayout);
  const [activeLayoutId, setActiveLayoutId] = useState<string>("blank");

  const bgColor = currentSlide?.background?.color ?? "#ffffff";

  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const bg: SlideBackground = { type: "solid", color: e.target.value };
      updateSlideBackground(bg);
    },
    [updateSlideBackground],
  );

  const handleApplyToAll = useCallback(() => {
    if (currentSlide?.background) {
      applyBackgroundToAll(currentSlide.background);
    }
  }, [currentSlide?.background, applyBackgroundToAll]);

  const handleApplyLayout = useCallback(
    (layoutId: string) => {
      const layout = SLIDE_LAYOUTS.find((l) => l.id === layoutId);
      if (layout) {
        setActiveLayoutId(layoutId);
        applyLayout(layout.elements);
      }
    },
    [applyLayout],
  );

  return (
    <div className="flex-1 overflow-y-auto">
      {/* 背景 */}
      <div className="border-b border-border-subtle px-4 py-3">
        <h3 className="mb-3 text-xs font-medium text-fg-muted">背景</h3>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-fg-default">颜色填充</span>
          <label className="relative cursor-pointer">
            <input
              type="color"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={bgColor}
              onChange={handleColorChange}
            />
            <div
              className="h-6 w-6 rounded border border-border-subtle"
              style={{ backgroundColor: bgColor }}
            />
          </label>
        </div>
        <button
          type="button"
          className="mt-2 w-full cursor-pointer rounded-md border border-border-subtle px-3 py-1.5 text-xs text-fg-default transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          onClick={handleApplyToAll}
        >
          应用到全部
        </button>
      </div>

      {/* 布局 */}
      <div className="px-4 py-3">
        <h3 className="mb-2 text-xs font-medium text-fg-muted">布局</h3>
        <div className="grid grid-cols-2 gap-2">
          {SLIDE_LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              type="button"
              className={
                activeLayoutId === layout.id
                  ? "flex cursor-pointer flex-col items-center rounded-md border-2 border-blue-500 bg-blue-50 p-1.5 transition-colors hover:bg-black/5 dark:bg-blue-500/10 dark:hover:bg-white/5"
                  : "flex cursor-pointer flex-col items-center rounded-md border-2 border-border-subtle p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              }
              onClick={() => handleApplyLayout(layout.id)}
            >
              <div className="mb-1 flex h-[50px] w-full items-center justify-center rounded bg-neutral-100 text-[9px] text-fg-muted dark:bg-neutral-800">
                {layout.name}
              </div>
              <span className="text-[10px] text-fg-muted">{layout.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SlidePanelNoSelection() {
  const [activeTab, setActiveTab] = useState("design");

  return (
    <>
      <PanelTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "design" && <DesignTab />}
      {activeTab === "transition" && <TransitionPanel />}
      {activeTab === "animation" && (
        <div className="flex flex-1 items-center justify-center p-4 text-sm text-fg-muted">
          请先选择元素
        </div>
      )}
    </>
  );
}
