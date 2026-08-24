import { cn } from "@tokimo/ui";
import { FlipHorizontal, FlipVertical } from "lucide-react";
import type { ElementOutline, SlideImageElement } from "../types";
import { useSlideStore } from "../use-slide-store";

const sectionClass = "border-b border-border-subtle px-4 py-3";
const labelClass = "mb-3 text-xs font-medium text-fg-muted";
const iconBtnClass =
  "flex cursor-pointer items-center justify-center rounded p-1.5 hover:bg-black/5 dark:hover:bg-white/5";

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-fg-muted">{label}</span>
      <input
        type="range"
        className="h-1 flex-1 cursor-pointer accent-[var(--accent)]"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-10 text-right text-xs text-fg-muted">
        {value}
        {unit}
      </span>
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-fg-muted">{label}</span>
      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded border border-border-subtle">
        <input
          type="color"
          className="absolute -inset-1 h-10 w-10 cursor-pointer"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <span className="text-xs text-fg-muted">{value}</span>
    </div>
  );
}

export function ImageStylePanel({ element }: { element: SlideImageElement }) {
  const updateElement = useSlideStore((s) => s.updateElement);
  const pushHistory = useSlideStore((s) => s.pushHistory);

  const update = (changes: Partial<SlideImageElement>) => {
    pushHistory();
    updateElement(element.id, changes);
  };

  const outline = element.outline;
  const shadow = element.shadow;
  const hasOutline = !!outline;
  const hasShadow = !!shadow;

  return (
    <div className="flex flex-col gap-0 pb-4">
      {/* 翻转 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>翻转</h3>
        <div className="flex gap-1">
          <button
            type="button"
            className={cn(
              iconBtnClass,
              element.flipH &&
                "bg-accent-subtle text-accent-text",
            )}
            title="水平翻转"
            onClick={() => update({ flipH: !element.flipH })}
          >
            <FlipHorizontal size={16} />
          </button>
          <button
            type="button"
            className={cn(
              iconBtnClass,
              element.flipV &&
                "bg-accent-subtle text-accent-text",
            )}
            title="垂直翻转"
            onClick={() => update({ flipV: !element.flipV })}
          >
            <FlipVertical size={16} />
          </button>
        </div>
      </div>

      {/* 圆角 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>圆角</h3>
        <SliderRow
          label="半径"
          value={element.radius ?? 0}
          min={0}
          max={50}
          step={1}
          onChange={(v) => update({ radius: v })}
          unit="px"
        />
      </div>

      {/* 描边 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>描边</h3>
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-fg-default">
          <input
            type="checkbox"
            className="cursor-pointer accent-[var(--accent)]"
            checked={hasOutline}
            onChange={(e) => {
              if (e.target.checked) {
                update({
                  outline: { color: "#000000", width: 2, style: "solid" },
                });
              } else {
                update({ outline: undefined });
              }
            }}
          />
          启用描边
        </label>
        {hasOutline && (
          <div className="flex flex-col gap-2">
            <ColorInput
              label="颜色"
              value={outline.color}
              onChange={(c) => update({ outline: { ...outline, color: c } })}
            />
            <SliderRow
              label="宽度"
              value={outline.width}
              min={1}
              max={10}
              step={1}
              onChange={(v) => update({ outline: { ...outline, width: v } })}
              unit="px"
            />
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-fg-muted">样式</span>
              <select
                className="h-7 flex-1 cursor-pointer rounded border border-border-subtle bg-transparent px-2 text-xs text-fg-default outline-none dark:bg-neutral-800"
                value={outline.style}
                onChange={(e) =>
                  update({
                    outline: {
                      ...outline,
                      style: e.target.value as ElementOutline["style"],
                    },
                  })
                }
              >
                <option value="solid">实线</option>
                <option value="dashed">虚线</option>
                <option value="dotted">点线</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 阴影 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>阴影</h3>
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-fg-default">
          <input
            type="checkbox"
            className="cursor-pointer accent-[var(--accent)]"
            checked={hasShadow}
            onChange={(e) => {
              if (e.target.checked) {
                update({
                  shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    blur: 6,
                    color: "rgba(0,0,0,0.3)",
                  },
                });
              } else {
                update({ shadow: undefined });
              }
            }}
          />
          启用阴影
        </label>
        {hasShadow && (
          <div className="flex flex-col gap-2">
            <SliderRow
              label="X 偏移"
              value={shadow.offsetX}
              min={-20}
              max={20}
              step={1}
              onChange={(v) => update({ shadow: { ...shadow, offsetX: v } })}
              unit="px"
            />
            <SliderRow
              label="Y 偏移"
              value={shadow.offsetY}
              min={-20}
              max={20}
              step={1}
              onChange={(v) => update({ shadow: { ...shadow, offsetY: v } })}
              unit="px"
            />
            <SliderRow
              label="模糊"
              value={shadow.blur}
              min={0}
              max={30}
              step={1}
              onChange={(v) => update({ shadow: { ...shadow, blur: v } })}
              unit="px"
            />
            <ColorInput
              label="颜色"
              value={shadow.color.startsWith("rgba") ? "#000000" : shadow.color}
              onChange={(c) => update({ shadow: { ...shadow, color: c } })}
            />
          </div>
        )}
      </div>

      {/* 透明度 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>透明度</h3>
        <SliderRow
          label="不透明度"
          value={Math.round((element.opacity ?? 1) * 100)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => update({ opacity: v / 100 })}
          unit="%"
        />
      </div>

      {/* 锁定比例 */}
      <div className="px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-default">
          <input
            type="checkbox"
            className="cursor-pointer accent-[var(--accent)]"
            checked={element.fixedRatio}
            onChange={(e) => update({ fixedRatio: e.target.checked })}
          />
          锁定比例
        </label>
      </div>
    </div>
  );
}
