import { cn } from "@tokiomo/components";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Eye,
  EyeOff,
  Layers,
  Maximize2,
  MoveRight,
  Replace,
} from "lucide-react";
import { useCallback } from "react";
import type { TransitionType } from "../types";
import { useSlideStore } from "../use-slide-store";

interface TransitionOption {
  type: TransitionType;
  label: string;
  icon: React.ReactNode;
}

const TRANSITION_OPTIONS: TransitionOption[] = [
  { type: "none", label: "无", icon: <EyeOff size={20} /> },
  { type: "fade", label: "淡入", icon: <Eye size={20} /> },
  { type: "slideLeft", label: "左滑", icon: <ArrowLeft size={20} /> },
  { type: "slideRight", label: "右滑", icon: <ArrowRight size={20} /> },
  { type: "slideUp", label: "上滑", icon: <ArrowUp size={20} /> },
  { type: "slideDown", label: "下滑", icon: <ArrowDown size={20} /> },
  { type: "scale", label: "缩放", icon: <Maximize2 size={20} /> },
  { type: "cover", label: "覆盖", icon: <Layers size={20} /> },
  { type: "push", label: "推入", icon: <MoveRight size={20} /> },
  { type: "reveal", label: "揭示", icon: <Replace size={20} /> },
];

export function TransitionPanel() {
  const currentSlide = useSlideStore((s) => s.currentSlide());
  const updateSlideTransition = useSlideStore((s) => s.updateSlideTransition);
  const applyTransitionToAll = useSlideStore((s) => s.applyTransitionToAll);

  const transition = currentSlide?.transition ?? {
    type: "none" as TransitionType,
    duration: 0.5,
  };

  const handleTypeChange = useCallback(
    (type: TransitionType) => {
      updateSlideTransition({ ...transition, type });
    },
    [transition, updateSlideTransition],
  );

  const handleDurationChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSlideTransition({
        ...transition,
        duration: Number(e.target.value),
      });
    },
    [transition, updateSlideTransition],
  );

  const handleApplyToAll = useCallback(() => {
    applyTransitionToAll(transition);
  }, [transition, applyTransitionToAll]);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Transition type grid */}
      <div className="border-b border-border-subtle px-4 py-3">
        <h3 className="mb-3 text-xs font-medium text-fg-muted">切换效果</h3>
        <div className="grid grid-cols-3 gap-2">
          {TRANSITION_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 p-2 transition-colors",
                transition.type === opt.type
                  ? "border-blue-500 bg-blue-50 text-blue-500 dark:bg-blue-500/10"
                  : "border-border-subtle text-fg-muted hover:bg-black/5 dark:hover:bg-white/5",
              )}
              onClick={() => handleTypeChange(opt.type)}
            >
              {opt.icon}
              <span className="text-[10px]">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="border-b border-border-subtle px-4 py-3">
        <h3 className="mb-2 text-xs font-medium text-fg-muted">持续时间</h3>
        <div className="flex items-center gap-2">
          <input
            type="range"
            className="h-1.5 flex-1 cursor-pointer accent-blue-500"
            min={0.3}
            max={3}
            step={0.1}
            value={transition.duration}
            onChange={handleDurationChange}
          />
          <span className="w-10 text-right text-xs text-fg-default">
            {transition.duration.toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Apply to all */}
      <div className="px-4 py-3">
        <button
          type="button"
          className="w-full cursor-pointer rounded-md border border-border-subtle px-3 py-1.5 text-xs text-fg-default transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          onClick={handleApplyToAll}
        >
          应用到全部
        </button>
      </div>
    </div>
  );
}
