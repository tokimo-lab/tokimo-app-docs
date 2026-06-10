import type {
  ElementOutline,
  Gradient,
  ShapeText,
  SlideShapeElement,
} from "../types";
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

const DEFAULT_GRADIENT: Gradient = {
  type: "linear",
  colors: [
    { offset: 0, color: "#ffffff" },
    { offset: 1, color: "#000000" },
  ],
  angle: 0,
};

const DEFAULT_TEXT: ShapeText = {
  content: "文本",
  defaultFontName: "Microsoft YaHei",
  defaultColor: "#333333",
  align: "center",
};

export function ShapeStylePanel({ element }: { element: SlideShapeElement }) {
  const updateElement = useSlideStore((s) => s.updateElement);
  const pushHistory = useSlideStore((s) => s.pushHistory);

  const update = (changes: Partial<SlideShapeElement>) => {
    pushHistory();
    updateElement(element.id, changes);
  };

  const outline = element.outline;
  const shadow = element.shadow;
  const gradient = element.gradient;
  const text = element.text;
  const hasOutline = !!outline;
  const hasShadow = !!shadow;
  const useGradient = !!gradient;
  const hasText = !!text;

  return (
    <div className="flex flex-col gap-0 pb-4">
      {/* 填充 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>填充</h3>
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-default">
            <input
              type="radio"
              name={`fill-mode-${element.id}`}
              className="cursor-pointer accent-[var(--accent)]"
              checked={!useGradient}
              onChange={() => update({ gradient: undefined })}
            />
            纯色
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-default">
            <input
              type="radio"
              name={`fill-mode-${element.id}`}
              className="cursor-pointer accent-[var(--accent)]"
              checked={useGradient}
              onChange={() => update({ gradient: DEFAULT_GRADIENT })}
            />
            渐变
          </label>
          {!useGradient && (
            <ColorInput
              label="颜色"
              value={element.fill}
              onChange={(c) => update({ fill: c })}
            />
          )}
        </div>
      </div>

      {/* 渐变编辑 */}
      {useGradient && gradient && (
        <div className={sectionClass}>
          <h3 className={labelClass}>渐变</h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-fg-muted">类型</span>
              <select
                className="h-7 flex-1 cursor-pointer rounded border border-border-subtle bg-transparent px-2 text-xs text-fg-default outline-none dark:bg-neutral-800"
                value={gradient.type}
                onChange={(e) =>
                  update({
                    gradient: {
                      ...gradient,
                      type: e.target.value as "linear" | "radial",
                    },
                  })
                }
              >
                <option value="linear">线性</option>
                <option value="radial">径向</option>
              </select>
            </div>
            {gradient.type === "linear" && (
              <SliderRow
                label="角度"
                value={gradient.angle ?? 0}
                min={0}
                max={360}
                step={1}
                onChange={(v) =>
                  update({ gradient: { ...gradient, angle: v } })
                }
                unit="°"
              />
            )}
            {gradient.colors.map((stop, i) => (
              <div key={stop.offset} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-fg-muted">
                  色标 {i + 1}
                </span>
                <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded border border-border-subtle">
                  <input
                    type="color"
                    className="absolute -inset-1 h-10 w-10 cursor-pointer"
                    value={stop.color}
                    onChange={(e) => {
                      const colors = [...gradient.colors];
                      colors[i] = { ...colors[i], color: e.target.value };
                      update({ gradient: { ...gradient, colors } });
                    }}
                  />
                </div>
                <input
                  type="number"
                  className="h-7 w-14 rounded border border-border-subtle bg-transparent px-2 text-xs text-fg-default outline-none dark:bg-neutral-800"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(stop.offset * 100)}
                  onChange={(e) => {
                    const colors = [...gradient.colors];
                    colors[i] = {
                      ...colors[i],
                      offset: Number(e.target.value) / 100,
                    };
                    update({ gradient: { ...gradient, colors } });
                  }}
                />
                <span className="text-xs text-fg-muted">%</span>
              </div>
            ))}
            {gradient.colors.length < 5 && (
              <button
                type="button"
                className="cursor-pointer text-xs text-[var(--accent)] hover:underline"
                onClick={() => {
                  const colors = [
                    ...gradient.colors,
                    { offset: 0.5, color: "#888888" },
                  ];
                  update({ gradient: { ...gradient, colors } });
                }}
              >
                + 添加色标
              </button>
            )}
          </div>
        </div>
      )}

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
        {hasOutline && outline && (
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
        {hasShadow && shadow && (
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

      {/* 文字 */}
      <div className="px-4 py-3">
        <h3 className={labelClass}>文字</h3>
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-fg-default">
          <input
            type="checkbox"
            className="cursor-pointer accent-[var(--accent)]"
            checked={hasText}
            onChange={(e) => {
              if (e.target.checked) {
                update({ text: DEFAULT_TEXT });
              } else {
                update({ text: undefined });
              }
            }}
          />
          文字叠加
        </label>
        {hasText && text && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-fg-muted">内容</span>
              <input
                type="text"
                className="h-7 flex-1 rounded border border-border-subtle bg-transparent px-2 text-xs text-fg-default outline-none focus:border-[var(--accent)] dark:bg-neutral-800"
                value={text.content}
                onChange={(e) =>
                  update({ text: { ...text, content: e.target.value } })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-fg-muted">字体</span>
              <input
                type="text"
                className="h-7 flex-1 rounded border border-border-subtle bg-transparent px-2 text-xs text-fg-default outline-none focus:border-[var(--accent)] dark:bg-neutral-800"
                value={text.defaultFontName}
                onChange={(e) =>
                  update({
                    text: { ...text, defaultFontName: e.target.value },
                  })
                }
              />
            </div>
            <ColorInput
              label="颜色"
              value={text.defaultColor}
              onChange={(c) => update({ text: { ...text, defaultColor: c } })}
            />
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-fg-muted">对齐</span>
              <select
                className="h-7 flex-1 cursor-pointer rounded border border-border-subtle bg-transparent px-2 text-xs text-fg-default outline-none dark:bg-neutral-800"
                value={text.align}
                onChange={(e) =>
                  update({
                    text: {
                      ...text,
                      align: e.target.value as ShapeText["align"],
                    },
                  })
                }
              >
                <option value="left">左对齐</option>
                <option value="center">居中</option>
                <option value="right">右对齐</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
