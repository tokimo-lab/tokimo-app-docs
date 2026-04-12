import { cn } from "@tokiomo/components";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Lock,
  Unlock,
} from "lucide-react";
import { useCallback } from "react";
import type { SlideElement } from "../types";
import { useSlideStore } from "../use-slide-store";

function NumericInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="w-5 text-xs font-medium text-fg-muted">{label}</span>
      <input
        type="number"
        className="h-7 w-full rounded border border-border-subtle bg-transparent px-2 text-xs text-fg-default outline-none focus:border-blue-500 dark:bg-neutral-800"
        value={Math.round(value)}
        step={1}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-[10px] text-fg-muted">px</span>
    </label>
  );
}

const iconBtnClass =
  "flex cursor-pointer items-center justify-center rounded p-1.5 hover:bg-black/5 dark:hover:bg-white/5";

function getHeight(el: SlideElement): number {
  return el.type === "line" ? 0 : el.height;
}

export function PositionPanel() {
  const selectedIds = useSlideStore((s) => s.selectedElementIds);
  const currentSlide = useSlideStore((s) => s.currentSlide());
  const updateElement = useSlideStore((s) => s.updateElement);
  const updateElements = useSlideStore((s) => s.updateElements);
  const bringToFront = useSlideStore((s) => s.bringToFront);
  const bringForward = useSlideStore((s) => s.bringForward);
  const sendBackward = useSlideStore((s) => s.sendBackward);
  const sendToBack = useSlideStore((s) => s.sendToBack);
  const pushHistory = useSlideStore((s) => s.pushHistory);

  const elements =
    currentSlide?.elements.filter((el) => selectedIds.includes(el.id)) ?? [];
  const element = elements[0] as SlideElement | undefined;
  const multiSelect = elements.length > 1;

  const handleUpdate = useCallback(
    (field: string, value: number | boolean) => {
      if (!element) return;
      pushHistory();
      updateElement(element.id, { [field]: value } as Partial<SlideElement>);
    },
    [element, pushHistory, updateElement],
  );

  const handleAlign = useCallback(
    (direction: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
      if (elements.length < 2) return;
      pushHistory();

      const updates: Array<{ id: string; changes: Partial<SlideElement> }> = [];

      switch (direction) {
        case "left": {
          const minLeft = Math.min(...elements.map((el) => el.left));
          for (const el of elements) {
            if (el.left !== minLeft) {
              updates.push({ id: el.id, changes: { left: minLeft } });
            }
          }
          break;
        }
        case "center": {
          const avgCenter =
            elements.reduce((sum, el) => sum + el.left + el.width / 2, 0) /
            elements.length;
          for (const el of elements) {
            updates.push({
              id: el.id,
              changes: { left: avgCenter - el.width / 2 },
            });
          }
          break;
        }
        case "right": {
          const maxRight = Math.max(
            ...elements.map((el) => el.left + el.width),
          );
          for (const el of elements) {
            updates.push({
              id: el.id,
              changes: { left: maxRight - el.width },
            });
          }
          break;
        }
        case "top": {
          const minTop = Math.min(...elements.map((el) => el.top));
          for (const el of elements) {
            if (el.top !== minTop) {
              updates.push({ id: el.id, changes: { top: minTop } });
            }
          }
          break;
        }
        case "middle": {
          const avgMiddle =
            elements.reduce((sum, el) => sum + el.top + getHeight(el) / 2, 0) /
            elements.length;
          for (const el of elements) {
            updates.push({
              id: el.id,
              changes: { top: avgMiddle - getHeight(el) / 2 },
            });
          }
          break;
        }
        case "bottom": {
          const maxBottom = Math.max(
            ...elements.map((el) => el.top + getHeight(el)),
          );
          for (const el of elements) {
            updates.push({
              id: el.id,
              changes: { top: maxBottom - getHeight(el) },
            });
          }
          break;
        }
      }

      if (updates.length > 0) {
        updateElements(updates);
      }
    },
    [elements, pushHistory, updateElements],
  );

  if (!element) {
    return (
      <div className="p-4 text-sm text-fg-muted">选择元素查看位置信息</div>
    );
  }

  const isLine = element.type === "line";
  const rotate = isLine
    ? 0
    : (element as Exclude<SlideElement, { type: "line" }>).rotate;
  const height = isLine ? 0 : element.height;
  const isLocked = element.lock === true;

  return (
    <div className="flex flex-col gap-0 pb-4">
      {/* 层级 */}
      <div className="border-b border-border-subtle px-4 py-3">
        <h3 className="mb-2 text-xs font-medium text-fg-muted">层级</h3>
        <div className="flex gap-1">
          <button
            type="button"
            className={iconBtnClass}
            title="置顶"
            onClick={() => bringToFront(element.id)}
          >
            <ArrowUpToLine size={16} />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            title="上移一层"
            onClick={() => bringForward(element.id)}
          >
            <ArrowUp size={16} />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            title="下移一层"
            onClick={() => sendBackward(element.id)}
          >
            <ArrowDown size={16} />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            title="置底"
            onClick={() => sendToBack(element.id)}
          >
            <ArrowDownToLine size={16} />
          </button>
        </div>
      </div>

      {/* 对齐 (multi-select only) */}
      {multiSelect && (
        <div className="border-b border-border-subtle px-4 py-3">
          <h3 className="mb-2 text-xs font-medium text-fg-muted">对齐</h3>
          <div className="flex gap-1">
            <button
              type="button"
              className={iconBtnClass}
              title="左对齐"
              onClick={() => handleAlign("left")}
            >
              <AlignStartVertical size={16} />
            </button>
            <button
              type="button"
              className={iconBtnClass}
              title="水平居中"
              onClick={() => handleAlign("center")}
            >
              <AlignCenterVertical size={16} />
            </button>
            <button
              type="button"
              className={iconBtnClass}
              title="右对齐"
              onClick={() => handleAlign("right")}
            >
              <AlignEndVertical size={16} />
            </button>
            <button
              type="button"
              className={iconBtnClass}
              title="顶部对齐"
              onClick={() => handleAlign("top")}
            >
              <AlignStartHorizontal size={16} />
            </button>
            <button
              type="button"
              className={iconBtnClass}
              title="垂直居中"
              onClick={() => handleAlign("middle")}
            >
              <AlignCenterHorizontal size={16} />
            </button>
            <button
              type="button"
              className={iconBtnClass}
              title="底部对齐"
              onClick={() => handleAlign("bottom")}
            >
              <AlignEndHorizontal size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 位置与尺寸 */}
      <div className="border-b border-border-subtle px-4 py-3">
        <h3 className="mb-2 text-xs font-medium text-fg-muted">位置</h3>
        <div className="grid grid-cols-2 gap-2">
          <NumericInput
            label="X"
            value={element.left}
            onChange={(v) => handleUpdate("left", v)}
          />
          <NumericInput
            label="Y"
            value={element.top}
            onChange={(v) => handleUpdate("top", v)}
          />
        </div>
      </div>

      {!isLine && (
        <div className="border-b border-border-subtle px-4 py-3">
          <h3 className="mb-2 text-xs font-medium text-fg-muted">尺寸</h3>
          <div className="grid grid-cols-2 gap-2">
            <NumericInput
              label="W"
              value={element.width}
              onChange={(v) => {
                if (v <= 0) return;
                const aspect = element.width / height;
                const changes: Partial<SlideElement> =
                  element.type === "image" && element.fixedRatio
                    ? { width: v, height: Math.round(v / aspect) }
                    : { width: v };
                pushHistory();
                updateElement(element.id, changes);
              }}
            />
            <NumericInput
              label="H"
              value={height}
              onChange={(v) => {
                if (v <= 0) return;
                const aspect = element.width / height;
                const changes: Partial<SlideElement> =
                  element.type === "image" && element.fixedRatio
                    ? { height: v, width: Math.round(v * aspect) }
                    : { height: v };
                pushHistory();
                updateElement(element.id, changes);
              }}
            />
          </div>
        </div>
      )}

      {/* 旋转 */}
      {!isLine && (
        <div className="border-b border-border-subtle px-4 py-3">
          <h3 className="mb-2 text-xs font-medium text-fg-muted">旋转</h3>
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="h-7 w-20 rounded border border-border-subtle bg-transparent px-2 text-xs text-fg-default outline-none focus:border-blue-500 dark:bg-neutral-800"
              value={Math.round(rotate)}
              step={1}
              onChange={(e) => handleUpdate("rotate", Number(e.target.value))}
            />
            <span className="text-[10px] text-fg-muted">°</span>
            <button
              type="button"
              className={cn(iconBtnClass, "text-xs")}
              title="-45°"
              onClick={() => handleUpdate("rotate", rotate - 45)}
            >
              -45°
            </button>
            <button
              type="button"
              className={cn(iconBtnClass, "text-xs")}
              title="+45°"
              onClick={() => handleUpdate("rotate", rotate + 45)}
            >
              +45°
            </button>
          </div>
        </div>
      )}

      {/* 锁定 */}
      {element.type === "image" && (
        <div className="px-4 py-3">
          <button
            type="button"
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/5",
              isLocked && "text-blue-500",
            )}
            onClick={() => handleUpdate("lock", !isLocked)}
          >
            {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
            {isLocked ? "已锁定比例" : "锁定比例"}
          </button>
        </div>
      )}
    </div>
  );
}
