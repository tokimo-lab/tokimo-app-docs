import {
  ChevronDown,
  GripVertical,
  MousePointerClick,
  Play,
  PlayCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
  EMPHASIS_EFFECTS,
  ENTRANCE_EFFECTS,
  EXIT_EFFECTS,
  getEffectLabel,
  getTriggerLabel,
  getTypeLabel,
} from "../lib/animation-effects";
import {
  createAnimationPlayer,
  previewAnimation,
} from "../lib/animation-player";
import type {
  AnimationEffect,
  AnimationTrigger,
  AnimationType,
  ElementAnimation,
} from "../types";
import { generateId } from "../types";
import { useSlideStore } from "../use-slide-store";

// ── Add Animation Dropdown ──────────────────────────────────
function AddAnimationDropdown({
  onAdd,
}: {
  onAdd: (effect: AnimationEffect, type: AnimationType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const groups = [
    { label: "入场", effects: ENTRANCE_EFFECTS },
    { label: "退场", effects: EXIT_EFFECTS },
    { label: "强调", effects: EMPHASIS_EFFECTS },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border-subtle px-3 py-1.5 text-sm text-fg-default transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        onClick={() => setOpen(!open)}
      >
        <Plus size={14} />
        添加动画
      </button>
      {open && (
        <>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-border-subtle bg-bg-default shadow-lg">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1.5 text-xs font-medium text-fg-muted">
                  {group.label}
                </div>
                {group.effects.map((meta) => (
                  <button
                    key={meta.effect}
                    type="button"
                    className="flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-sm text-fg-default hover:bg-black/5 dark:hover:bg-white/5"
                    onClick={() => {
                      onAdd(meta.effect, meta.type);
                      setOpen(false);
                    }}
                  >
                    {meta.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Trigger Select ──────────────────────────────────────────
function TriggerSelect({
  value,
  onChange,
}: {
  value: AnimationTrigger;
  onChange: (v: AnimationTrigger) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggers: AnimationTrigger[] = [
    "onClick",
    "withPrevious",
    "afterPrevious",
  ];

  return (
    <div className="relative">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between rounded-md border border-border-subtle px-2 py-1 text-sm text-fg-default"
        onClick={() => setOpen(!open)}
      >
        {getTriggerLabel(value)}
        <ChevronDown size={14} />
      </button>
      {open && (
        <>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-md border border-border-subtle bg-bg-default shadow-lg">
            {triggers.map((t) => (
              <button
                key={t}
                type="button"
                className="flex w-full cursor-pointer items-center px-2 py-1.5 text-left text-sm text-fg-default hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
              >
                {getTriggerLabel(t)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Duration/Delay Slider ───────────────────────────────────
function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-xs text-fg-muted">{label}</span>
      <input
        type="range"
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border-subtle accent-blue-500"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-14 shrink-0 text-right text-xs text-fg-muted">
        {value}ms
      </span>
    </div>
  );
}

// ── Animation List Item ─────────────────────────────────────
function AnimationItem({
  anim,
  index,
  selected,
  elementLabel,
  onSelect,
  onDelete,
}: {
  anim: ElementAnimation;
  index: number;
  selected: boolean;
  elementLabel: string;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const typeColors: Record<AnimationType, string> = {
    entrance: "bg-green-500",
    exit: "bg-red-500",
    emphasis: "bg-yellow-500",
  };

  return (
    <button
      type="button"
      className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        selected
          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
          : "text-fg-default hover:bg-black/5 dark:hover:bg-white/5"
      }`}
      onClick={onSelect}
    >
      <GripVertical size={14} className="shrink-0 text-fg-muted" />
      <span className="mr-1 text-xs text-fg-muted">{index + 1}</span>
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${typeColors[anim.type]}`}
      />
      <span className="flex-1 truncate">
        {getEffectLabel(anim.effect)}
        <span className="ml-1 text-xs text-fg-muted">({elementLabel})</span>
      </span>
      {anim.trigger === "onClick" && (
        <MousePointerClick size={12} className="shrink-0 text-fg-muted" />
      )}
      <span className="shrink-0 text-xs text-fg-muted">{anim.duration}ms</span>
      <button
        type="button"
        className="cursor-pointer rounded p-0.5 text-fg-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={12} />
      </button>
    </button>
  );
}

// ── Main Panel ──────────────────────────────────────────────
export function AnimationPanel() {
  const [selectedAnimId, setSelectedAnimId] = useState<string | null>(null);

  const currentSlide = useSlideStore((s) => s.currentSlide());
  const selectedElementIds = useSlideStore((s) => s.selectedElementIds);
  const addAnimation = useSlideStore((s) => s.addAnimation);
  const updateAnimation = useSlideStore((s) => s.updateAnimation);
  const deleteAnimation = useSlideStore((s) => s.deleteAnimation);

  const slideId = currentSlide?.id;
  const allAnimations = currentSlide?.animations ?? [];

  // Show animations for selected element, or all if nothing selected
  const elementAnimations =
    selectedElementIds.length > 0
      ? allAnimations.filter((a) => selectedElementIds.includes(a.elementId))
      : allAnimations;
  const sortedAnimations = [...elementAnimations].sort(
    (a, b) => a.order - b.order,
  );

  const selectedAnim = allAnimations.find((a) => a.id === selectedAnimId);

  const getElementLabel = useCallback(
    (elementId: string): string => {
      const el = currentSlide?.elements.find((e) => e.id === elementId);
      if (!el) return "未知";
      switch (el.type) {
        case "text":
          return "文本";
        case "image":
          return "图片";
        case "shape":
          return "形状";
        case "line":
          return "线条";
        default:
          return "元素";
      }
    },
    [currentSlide?.elements],
  );

  const handleAdd = useCallback(
    (effect: AnimationEffect, type: AnimationType) => {
      if (!slideId || selectedElementIds.length === 0) return;
      const newAnim: ElementAnimation = {
        id: generateId(),
        elementId: selectedElementIds[0],
        type,
        effect,
        trigger: "onClick",
        duration: 500,
        delay: 0,
        order: allAnimations.length,
      };
      addAnimation(slideId, newAnim);
      setSelectedAnimId(newAnim.id);
    },
    [slideId, selectedElementIds, allAnimations.length, addAnimation],
  );

  const handleUpdate = useCallback(
    (updates: Partial<ElementAnimation>) => {
      if (!slideId || !selectedAnimId) return;
      updateAnimation(slideId, selectedAnimId, updates);
    },
    [slideId, selectedAnimId, updateAnimation],
  );

  const handleDelete = useCallback(
    (animId: string) => {
      if (!slideId) return;
      deleteAnimation(slideId, animId);
      if (selectedAnimId === animId) setSelectedAnimId(null);
    },
    [slideId, selectedAnimId, deleteAnimation],
  );

  const handlePreview = useCallback(() => {
    if (!selectedAnim) return;
    const el = document.querySelector(
      `[data-element-id="${selectedAnim.elementId}"]`,
    );
    if (el instanceof HTMLElement) {
      previewAnimation(el, selectedAnim);
    }
  }, [selectedAnim]);

  const handlePlayAll = useCallback(() => {
    const sorted = [...allAnimations].sort((a, b) => a.order - b.order);
    if (sorted.length === 0) return;
    const player = createAnimationPlayer(sorted, (elementId) => {
      const el = document.querySelector(`[data-element-id="${elementId}"]`);
      return el instanceof HTMLElement ? el : null;
    });
    player.play();
  }, [allAnimations]);

  if (!currentSlide) {
    return <div className="p-4 text-sm text-fg-muted">没有选中的幻灯片</div>;
  }

  if (selectedElementIds.length === 0) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-fg-muted">选择元素以添加动画</p>
        {allAnimations.length > 0 && (
          <>
            <div className="text-xs font-medium text-fg-muted">
              当前幻灯片动画 ({allAnimations.length})
            </div>
            <div className="flex flex-col gap-0.5">
              {sortedAnimations.map((anim, i) => (
                <AnimationItem
                  key={anim.id}
                  anim={anim}
                  index={i}
                  selected={anim.id === selectedAnimId}
                  elementLabel={getElementLabel(anim.elementId)}
                  onSelect={() => setSelectedAnimId(anim.id)}
                  onDelete={() => handleDelete(anim.id)}
                />
              ))}
            </div>
            <button
              type="button"
              className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-subtle px-3 py-1.5 text-sm text-fg-default transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              onClick={handlePlayAll}
            >
              <PlayCircle size={14} />
              播放全部
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Add button */}
      <AddAnimationDropdown onAdd={handleAdd} />

      {/* Animation list */}
      {sortedAnimations.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <div className="mb-1 text-xs font-medium text-fg-muted">动画列表</div>
          {sortedAnimations.map((anim, i) => (
            <AnimationItem
              key={anim.id}
              anim={anim}
              index={i}
              selected={anim.id === selectedAnimId}
              elementLabel={getElementLabel(anim.elementId)}
              onSelect={() => setSelectedAnimId(anim.id)}
              onDelete={() => handleDelete(anim.id)}
            />
          ))}
        </div>
      )}

      {/* Properties editor */}
      {selectedAnim && (
        <div className="flex flex-col gap-3 border-t border-border-subtle pt-3">
          <div className="text-xs font-medium text-fg-muted">动画属性</div>

          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-xs text-fg-muted">效果</span>
            <span className="flex-1 text-sm text-fg-default">
              {getEffectLabel(selectedAnim.effect)}
              <span className="ml-1 text-xs text-fg-muted">
                ({getTypeLabel(selectedAnim.type)})
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-xs text-fg-muted">触发</span>
            <div className="flex-1">
              <TriggerSelect
                value={selectedAnim.trigger}
                onChange={(trigger) => handleUpdate({ trigger })}
              />
            </div>
          </div>

          <SliderField
            label="时长"
            value={selectedAnim.duration}
            min={100}
            max={5000}
            step={100}
            onChange={(duration) => handleUpdate({ duration })}
          />

          <SliderField
            label="延迟"
            value={selectedAnim.delay}
            min={0}
            max={5000}
            step={100}
            onChange={(delay) => handleUpdate({ delay })}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 border-t border-border-subtle pt-3">
        {selectedAnim && (
          <button
            type="button"
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-subtle px-3 py-1.5 text-sm text-fg-default transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            onClick={handlePreview}
          >
            <Play size={14} />
            预览
          </button>
        )}
        {sortedAnimations.length > 0 && (
          <button
            type="button"
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-subtle px-3 py-1.5 text-sm text-fg-default transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            onClick={handlePlayAll}
          >
            <PlayCircle size={14} />
            播放全部
          </button>
        )}
      </div>
    </div>
  );
}
