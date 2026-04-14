import { cn } from "@tokiomo/components";
import { Calendar } from "lucide-react";
import { useEffect, useRef } from "react";
import type { BaseEditorState } from "../useBaseEditor";

interface CalendarConfigPanelProps {
  state: BaseEditorState;
  onClose: () => void;
}

export function CalendarConfigPanel({
  state,
  onClose,
}: CalendarConfigPanelProps) {
  const { fields, activeView } = state;
  const panelRef = useRef<HTMLDivElement>(null);
  const dateFieldId = activeView?.calendarConfig?.dateFieldId ?? "";

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
    <div
      ref={panelRef}
      className="w-56 rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[rgba(38,38,58,0.88)] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
    >
      <div className="border-b border-border-subtle px-3 py-2 text-xs font-medium text-fg-primary">
        日历配置
      </div>
      <div className="p-2">
        <div className="mb-1 px-1 text-[10px] text-fg-muted">日期字段</div>
        {dateFields.length === 0 ? (
          <div className="px-1 py-2 text-xs text-fg-muted">
            暂无日期字段，请先添加一个日期类型的字段
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {dateFields.map((f) => (
              <button
                key={f.id}
                type="button"
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                  f.id === dateFieldId
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                    : "text-fg-secondary hover:bg-fill-tertiary",
                )}
                onClick={() => {
                  state.setCalendarDateField(f.id);
                  onClose();
                }}
              >
                <Calendar size={14} />
                {f.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
