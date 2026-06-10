import type { LinePoint, SlideLineElement } from "../types";
import { useSlideStore } from "../use-slide-store";

const sectionClass = "border-b border-border-subtle px-4 py-3";
const labelClass = "mb-3 text-xs font-medium text-fg-muted";

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

export function LineStylePanel({ element }: { element: SlideLineElement }) {
  const updateElement = useSlideStore((s) => s.updateElement);
  const pushHistory = useSlideStore((s) => s.pushHistory);

  const update = (changes: Partial<SlideLineElement>) => {
    pushHistory();
    updateElement(element.id, changes);
  };

  return (
    <div className="flex flex-col gap-0 pb-4">
      {/* 颜色 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>颜色</h3>
        <div className="flex items-center gap-2">
          <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded border border-border-subtle">
            <input
              type="color"
              className="absolute -inset-1 h-10 w-10 cursor-pointer"
              value={element.color}
              onChange={(e) => update({ color: e.target.value })}
            />
          </div>
          <span className="text-xs text-fg-muted">{element.color}</span>
        </div>
      </div>

      {/* 宽度 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>宽度</h3>
        <SliderRow
          label="粗细"
          value={element.strokeWidth ?? 2}
          min={1}
          max={20}
          step={1}
          onChange={(v) => update({ strokeWidth: v })}
          unit="px"
        />
      </div>

      {/* 样式 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>样式</h3>
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs text-fg-muted">线型</span>
          <select
            className="h-7 flex-1 cursor-pointer rounded border border-border-subtle bg-transparent px-2 text-xs text-fg-default outline-none dark:bg-neutral-800"
            value={element.style}
            onChange={(e) =>
              update({ style: e.target.value as SlideLineElement["style"] })
            }
          >
            <option value="solid">实线</option>
            <option value="dashed">虚线</option>
            <option value="dotted">点线</option>
          </select>
        </div>
      </div>

      {/* 起点 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>起点</h3>
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs text-fg-muted">类型</span>
          <select
            className="h-7 flex-1 cursor-pointer rounded border border-border-subtle bg-transparent px-2 text-xs text-fg-default outline-none dark:bg-neutral-800"
            value={element.points[0]}
            onChange={(e) =>
              update({
                points: [e.target.value as LinePoint, element.points[1]],
              })
            }
          >
            <option value="">无</option>
            <option value="arrow">箭头</option>
            <option value="dot">圆点</option>
          </select>
        </div>
      </div>

      {/* 终点 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>终点</h3>
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs text-fg-muted">类型</span>
          <select
            className="h-7 flex-1 cursor-pointer rounded border border-border-subtle bg-transparent px-2 text-xs text-fg-default outline-none dark:bg-neutral-800"
            value={element.points[1]}
            onChange={(e) =>
              update({
                points: [element.points[0], e.target.value as LinePoint],
              })
            }
          >
            <option value="">无</option>
            <option value="arrow">箭头</option>
            <option value="dot">圆点</option>
          </select>
        </div>
      </div>

      {/* 透明度 */}
      <div className="px-4 py-3">
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
    </div>
  );
}
