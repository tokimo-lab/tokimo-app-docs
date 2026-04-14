import { cn } from "@tokiomo/components";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { BaseEditorState } from "../useBaseEditor";
import { getMonthGrid, getProcessedRecords, WEEKDAY_LABELS } from "../utils";
import { CalendarDayCell } from "./CalendarDayCell";
import { CalendarRecordPopover } from "./CalendarRecordPopover";

interface CalendarViewProps {
  state: BaseEditorState;
}

// Stable colors for record bars
const RECORD_COLORS = [
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#f97316", // orange-500
  "#10b981", // emerald-500
  "#06b6d4", // cyan-500
  "#eab308", // yellow-500
  "#ef4444", // red-500
];

function getRecordColor(index: number): string {
  return RECORD_COLORS[index % RECORD_COLORS.length];
}

export function CalendarView({ state }: CalendarViewProps) {
  const { activeView, fields, records } = state;
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const dateFieldId = activeView?.calendarConfig?.dateFieldId ?? "";
  const dateField = fields.find((f) => f.id === dateFieldId);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const processedRecords = useMemo(
    () =>
      activeView ? getProcessedRecords(records, activeView, fields) : records,
    [records, activeView, fields],
  );

  // Build a stable record-to-index map for coloring
  const recordIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < processedRecords.length; i++) {
      map.set(processedRecords[i].id, i);
    }
    return map;
  }, [processedRecords]);

  const weeks = useMemo(
    () => getMonthGrid(year, month, processedRecords, dateFieldId),
    [year, month, processedRecords, dateFieldId],
  );

  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const goNext = () => setCurrentDate(new Date(year, month + 1, 1));

  const selectedRecord = selectedRecordId
    ? records.find((r) => r.id === selectedRecordId)
    : null;

  if (!dateField) {
    return (
      <div className="flex h-full items-center justify-center text-fg-muted">
        <div className="text-center">
          <p className="text-sm">请先配置日期字段</p>
          <p className="mt-1 text-xs">
            在工具栏点击「日历配置」选择一个日期字段
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Navigation bar */}
      <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-2">
        <button
          type="button"
          className="cursor-pointer rounded border border-border-subtle px-2 py-0.5 text-xs text-fg-secondary hover:bg-fill-tertiary"
          onClick={goToday}
        >
          今天
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="cursor-pointer rounded p-0.5 text-fg-muted hover:bg-fill-tertiary"
            onClick={goPrev}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="cursor-pointer rounded p-0.5 text-fg-muted hover:bg-fill-tertiary"
            onClick={goNext}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <span className="text-sm font-medium text-fg-primary">
          {year}年{month + 1}月
        </span>
        <div className="flex-1" />
        {/* View mode toggle (only month for now) */}
        <div className="flex items-center rounded border border-border-subtle text-xs">
          {(["day", "week", "month"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={cn(
                "cursor-pointer px-2 py-0.5 transition-colors",
                activeView?.calendarConfig?.viewMode === mode
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                  : "text-fg-muted hover:bg-fill-tertiary",
              )}
              onClick={() => state.setCalendarViewMode(mode)}
            >
              {mode === "day" ? "日" : mode === "week" ? "周" : "月"}
            </button>
          ))}
        </div>
      </div>

      {/* Month grid */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-border-subtle">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="py-1 text-center text-xs text-fg-muted">
              {label}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="grid flex-1 grid-rows-6">
          {weeks.map((week, wi) => (
            <div
              key={`w-${week[0].dateStr}`}
              className={cn(
                "grid grid-cols-7",
                wi < 5 && "border-b border-border-subtle",
              )}
            >
              {week.map((day) => (
                <CalendarDayCell
                  key={day.dateStr}
                  day={day}
                  recordIndexMap={recordIndexMap}
                  getRecordColor={getRecordColor}
                  fields={fields}
                  onClickDate={() => state.addRecordOnDate(day.dateStr)}
                  onClickRecord={(recordId, e) => {
                    const rect = (
                      e.currentTarget as HTMLElement
                    ).getBoundingClientRect();
                    setPopoverAnchor({
                      top: rect.bottom + 4,
                      left: rect.left,
                    });
                    setSelectedRecordId(recordId);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Record popover */}
      {selectedRecord && popoverAnchor && (
        <CalendarRecordPopover
          record={selectedRecord}
          fields={fields}
          position={popoverAnchor}
          onClose={() => {
            setSelectedRecordId(null);
            setPopoverAnchor(null);
          }}
          onUpdateCell={(fieldId, value) =>
            state.updateCell(selectedRecord.id, fieldId, value)
          }
        />
      )}
    </div>
  );
}
