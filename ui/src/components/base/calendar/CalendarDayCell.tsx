import { cn } from "@tokimo/ui";
import { Plus } from "lucide-react";
import type { Field } from "../types";
import type { CalendarDay } from "../utils";

interface CalendarDayCellProps {
  day: CalendarDay;
  recordIndexMap: Map<string, number>;
  getRecordColor: (index: number) => string;
  fields: Field[];
  onClickDate: () => void;
  onDragStart: (recordId: string, e: React.PointerEvent) => void;
  isDropTarget?: boolean;
}

const MAX_VISIBLE_RECORDS = 3;

export function CalendarDayCell({
  day,
  recordIndexMap,
  getRecordColor,
  fields,
  onClickDate,
  onDragStart,
  isDropTarget,
}: CalendarDayCellProps) {
  const titleField = fields.find((f) => f.type === "text");
  const visibleRecords = day.records.slice(0, MAX_VISIBLE_RECORDS);
  const overflow = day.records.length - MAX_VISIBLE_RECORDS;

  return (
    <div
      data-date={day.dateStr}
      className={cn(
        "group/cell flex min-h-0 flex-col border-r border-border-subtle p-1 last:border-r-0",
        !day.isCurrentMonth && "bg-fill-tertiary/30",
        isDropTarget && "bg-[var(--accent-subtle)]",
      )}
    >
      {/* Date number */}
      <div className="mb-0.5 flex items-center justify-between">
        <span
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
            day.isToday
              ? "bg-[var(--accent)] font-medium text-white"
              : day.isCurrentMonth
                ? "text-fg-primary"
                : "text-fg-disabled",
          )}
        >
          {day.date.getDate()}
        </span>
        <button
          type="button"
          className="invisible cursor-pointer rounded p-0.5 text-fg-muted hover:bg-fill-tertiary group-hover/cell:visible"
          onClick={onClickDate}
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Record bars */}
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
        {visibleRecords.map((rec) => {
          const idx = recordIndexMap.get(rec.id) ?? 0;
          const color = getRecordColor(idx);
          const title = titleField ? String(rec.data[titleField.id] || "") : "";
          return (
            <button
              key={rec.id}
              type="button"
              className="flex cursor-pointer items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight hover:opacity-80"
              style={{ backgroundColor: `${color}20`, color }}
              onPointerDown={(e) => {
                e.preventDefault();
                onDragStart(rec.id, e);
              }}
            >
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="truncate">{title || "未命名"}</span>
            </button>
          );
        })}
        {overflow > 0 && (
          <span className="px-1 text-[10px] text-fg-muted">
            +{overflow} 更多
          </span>
        )}
      </div>
    </div>
  );
}
