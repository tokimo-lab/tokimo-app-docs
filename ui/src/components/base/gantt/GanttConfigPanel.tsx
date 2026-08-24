import { cn } from "@tokimo/ui";
import { Check } from "lucide-react";
import { useEffect, useRef } from "react";
import type { BaseEditorState } from "../useBaseEditor";
import { GANTT_COLORS } from "../utils";

interface GanttConfigPanelProps {
  state: BaseEditorState;
  onClose: () => void;
}

export function GanttConfigPanel({ state, onClose }: GanttConfigPanelProps) {
  const { fields, activeView } = state;
  const panelRef = useRef<HTMLDivElement>(null);
  const cfg = activeView?.ganttConfig;

  const dateFields = fields.filter((f) => f.type === "date");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div ref={panelRef} className="w-64">
      <div className="border-b border-border-subtle px-3 py-2 text-xs font-medium text-fg-primary">
        甘特图配置
      </div>
      <div className="space-y-3 p-3">
        {/* Start date field */}
        <div>
          <div className="mb-1 text-[10px] text-fg-muted">开始日期</div>
          {dateFields.length === 0 ? (
            <div className="text-xs text-fg-muted">暂无日期字段</div>
          ) : (
            <select
              className="w-full cursor-pointer rounded border border-border-subtle bg-surface-base px-2 py-1 text-xs text-fg-secondary outline-none focus:border-[var(--accent)]"
              value={cfg?.startDateFieldId ?? ""}
              onChange={(e) =>
                state.setGanttConfig({ startDateFieldId: e.target.value })
              }
            >
              <option value="">请选择</option>
              {dateFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* End date field */}
        <div>
          <div className="mb-1 text-[10px] text-fg-muted">结束日期</div>
          {dateFields.length === 0 ? (
            <div className="text-xs text-fg-muted">暂无日期字段</div>
          ) : (
            <select
              className="w-full cursor-pointer rounded border border-border-subtle bg-surface-base px-2 py-1 text-xs text-fg-secondary outline-none focus:border-[var(--accent)]"
              value={cfg?.endDateFieldId ?? ""}
              onChange={(e) =>
                state.setGanttConfig({ endDateFieldId: e.target.value })
              }
            >
              <option value="">请选择</option>
              {dateFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Title field */}
        <div>
          <div className="mb-1 text-[10px] text-fg-muted">标题展示</div>
          <select
            className="w-full cursor-pointer rounded border border-border-subtle bg-surface-base px-2 py-1 text-xs text-fg-secondary outline-none focus:border-[var(--accent)]"
            value={cfg?.titleFieldId ?? ""}
            onChange={(e) =>
              state.setGanttConfig({ titleFieldId: e.target.value })
            }
          >
            <option value="">请选择</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Color picker */}
        <div>
          <div className="mb-1 text-[10px] text-fg-muted">颜色</div>
          <div className="flex flex-wrap gap-1.5">
            {GANTT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110"
                style={{ backgroundColor: color }}
                onClick={() => state.setGanttConfig({ customColor: color })}
              >
                {cfg?.customColor === color && (
                  <Check size={12} className="text-white" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Workdays only toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-fg-muted">仅计算工作日</span>
          <button
            type="button"
            className={cn(
              "relative h-5 w-9 cursor-pointer rounded-full transition-colors",
              cfg?.workdaysOnly
                ? "bg-[var(--accent)]"
                : "bg-fill-tertiary",
            )}
            onClick={() =>
              state.setGanttConfig({ workdaysOnly: !cfg?.workdaysOnly })
            }
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                cfg?.workdaysOnly && "translate-x-4",
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
