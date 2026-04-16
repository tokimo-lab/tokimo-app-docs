import { cn } from "@tokiomo/components";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useCallback, useState } from "react";
import { SLIDE_LAYOUTS } from "./lib/layouts";
import type { SlideBackground } from "./types";
import { useSlideStore } from "./use-slide-store";

interface SlideFormatPanelProps {
  onClose: () => void;
}

export function SlideFormatPanel({ onClose }: SlideFormatPanelProps) {
  const currentSlide = useSlideStore((s) => s.currentSlide());
  const updateSlideBackground = useSlideStore((s) => s.updateSlideBackground);
  const applyBackgroundToAll = useSlideStore((s) => s.applyBackgroundToAll);
  const applyLayout = useSlideStore((s) => s.applyLayout);
  const [layoutOpen, setLayoutOpen] = useState(true);
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
    <div className="flex w-[280px] shrink-0 flex-col border-l border-border-subtle bg-white dark:bg-neutral-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <span className="text-sm font-medium text-fg-default">幻灯片格式</span>
        <button
          type="button"
          className="cursor-pointer rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/5"
          onClick={onClose}
        >
          <X size={16} className="text-fg-muted" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 背景 section */}
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

        {/* 布局 section */}
        <div className="px-4 py-3">
          <button
            type="button"
            className="mb-2 flex w-full cursor-pointer items-center gap-1 text-xs font-medium text-fg-muted"
            onClick={() => setLayoutOpen(!layoutOpen)}
          >
            {layoutOpen ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
            布局
          </button>
          {layoutOpen && (
            <>
              <p className="mb-2 text-[11px] text-fg-muted">默认母版</p>
              <div className="grid grid-cols-2 gap-2">
                {SLIDE_LAYOUTS.map((layout) => (
                  <button
                    key={layout.id}
                    type="button"
                    className={cn(
                      "flex cursor-pointer flex-col items-center rounded-md border-2 p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5",
                      activeLayoutId === layout.id
                        ? "border-[var(--accent)] bg-[var(--accent-subtle)] dark:bg-[var(--accent-subtle)]0/10"
                        : "border-border-subtle",
                    )}
                    onClick={() => handleApplyLayout(layout.id)}
                  >
                    <div className="mb-1 flex h-[50px] w-full items-center justify-center rounded bg-neutral-100 text-[9px] text-fg-muted dark:bg-neutral-800">
                      {layout.name}
                    </div>
                    <span className="text-[10px] text-fg-muted">
                      {layout.name}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
