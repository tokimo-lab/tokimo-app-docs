import { cn } from "@tokiomo/components";
import { Plus } from "lucide-react";
import { forwardRef, useCallback } from "react";
import type { Field } from "../types";
import { isWeekend, toDateStr } from "../utils";
import { GanttTaskBar } from "./GanttTaskBar";
import type { GanttRow } from "./GanttView";

interface GanttTimelineProps {
  days: Date[];
  rows: GanttRow[];
  year: number;
  month: number;
  todayStr: string;
  startFieldId: string;
  endFieldId: string;
  titleFieldId: string;
  fields: Field[];
  barColor: string;
  rowHeight: number;
  colWidth: number;
  onSyncScroll: () => void;
  onSetDates: (recordId: string, start: string, end: string) => void;
}

export const GanttTimeline = forwardRef<HTMLDivElement, GanttTimelineProps>(
  function GanttTimeline(
    {
      days,
      rows,
      year,
      month,
      todayStr,
      startFieldId,
      endFieldId,
      titleFieldId,
      fields,
      barColor,
      rowHeight,
      colWidth,
      onSyncScroll,
      onSetDates,
    },
    ref,
  ) {
    const totalWidth = days.length * colWidth;
    const firstDateStr = days.length > 0 ? toDateStr(days[0]) : "";
    const todayIndex = days.findIndex((d) => toDateStr(d) === todayStr);
    const titleField = fields.find((f) => f.id === titleFieldId);

    return (
      <div className="flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className="shrink-0 overflow-x-auto border-b border-border-subtle"
          style={{ minWidth: "100%" }}
        >
          <div style={{ width: totalWidth }}>
            <div
              className="flex items-center border-b border-border-subtle px-3 text-xs font-medium text-fg-primary"
              style={{ height: 28 }}
            >
              {year}年{month + 1}月
            </div>
            <div className="flex" style={{ height: 28 }}>
              {days.map((day) => {
                const ds = toDateStr(day);
                const weekend = isWeekend(day);
                const isToday = ds === todayStr;
                return (
                  <div
                    key={ds}
                    className={cn(
                      "flex shrink-0 items-center justify-center text-[11px]",
                      weekend
                        ? "bg-fill-quaternary/30 text-fg-muted dark:bg-fill-quaternary/20"
                        : "text-fg-secondary",
                      isToday && "font-bold text-[var(--accent)]",
                    )}
                    style={{ width: colWidth }}
                  >
                    {day.getDate()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Body */}
        <div ref={ref} className="flex-1 overflow-auto" onScroll={onSyncScroll}>
          <div
            className="relative"
            style={{ width: totalWidth, minHeight: "100%" }}
          >
            {/* Weekend bg columns */}
            {days.map((day, idx) => {
              if (!isWeekend(day)) return null;
              const ds = toDateStr(day);
              return (
                <div
                  key={`bg-${ds}`}
                  className="absolute top-0 bottom-0 bg-fill-quaternary/30 dark:bg-fill-quaternary/20"
                  style={{ left: idx * colWidth, width: colWidth }}
                />
              );
            })}

            {/* Today line */}
            {todayIndex >= 0 && (
              <>
                <div
                  className="absolute top-0 z-10 rounded-b px-1 text-[10px] font-medium text-white"
                  style={{
                    left: todayIndex * colWidth + colWidth / 2 - 14,
                    backgroundColor: "#3b82f6",
                  }}
                >
                  今天
                </div>
                <div
                  className="absolute top-0 bottom-0 z-10 w-px"
                  style={{
                    left: todayIndex * colWidth + colWidth / 2,
                    backgroundColor: "#3b82f6",
                  }}
                />
              </>
            )}

            {/* Row lanes */}
            {rows.map((row) => {
              if (row.type === "group") {
                return (
                  <div
                    key={`tg-${row.key}`}
                    className="border-b border-border-subtle bg-fill-secondary/50 dark:bg-fill-secondary/30"
                    style={{ height: rowHeight }}
                  />
                );
              }

              const rec = row.record;
              const startVal = rec.data[startFieldId];
              const endVal = rec.data[endFieldId];
              const hasStart = typeof startVal === "string" && startVal !== "";
              const hasEnd = typeof endVal === "string" && endVal !== "";
              const hasDates = hasStart && hasEnd;
              const titleVal = titleField
                ? String(rec.data[titleFieldId] ?? "")
                : "";

              return (
                <GanttRowLane
                  key={rec.id}
                  recordId={rec.id}
                  hasDates={hasDates}
                  startVal={hasStart ? (startVal as string) : ""}
                  endVal={hasEnd ? (endVal as string) : ""}
                  titleVal={titleVal}
                  firstDateStr={firstDateStr}
                  barColor={barColor}
                  rowHeight={rowHeight}
                  colWidth={colWidth}
                  days={days}
                  onSetDates={onSetDates}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);

interface GanttRowLaneProps {
  recordId: string;
  hasDates: boolean;
  startVal: string;
  endVal: string;
  titleVal: string;
  firstDateStr: string;
  barColor: string;
  rowHeight: number;
  colWidth: number;
  days: Date[];
  onSetDates: (recordId: string, start: string, end: string) => void;
}

function GanttRowLane({
  recordId,
  hasDates,
  startVal,
  endVal,
  titleVal,
  firstDateStr,
  barColor,
  rowHeight,
  colWidth,
  days,
  onSetDates,
}: GanttRowLaneProps) {
  const handleAddDates = () => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 3);
    onSetDates(recordId, toDateStr(today), toDateStr(end));
  };

  const handleClickEmpty = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      // Don't handle if clicked the inner span
      if ((e.target as HTMLElement).closest("span")) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const dayIndex = Math.floor(localX / colWidth);
      if (dayIndex >= 0 && dayIndex < days.length) {
        const dateStr = toDateStr(days[dayIndex]);
        onSetDates(recordId, dateStr, dateStr);
      }
    },
    [colWidth, days, recordId, onSetDates],
  );

  return (
    <div
      className="group/lane relative border-b border-border-subtle"
      style={{ height: rowHeight }}
    >
      {hasDates ? (
        <GanttTaskBar
          startDate={startVal}
          endDate={endVal}
          title={titleVal}
          firstDateStr={firstDateStr}
          barColor={barColor}
          rowHeight={rowHeight}
          colWidth={colWidth}
          recordId={recordId}
          onSetDates={onSetDates}
        />
      ) : (
        <button
          type="button"
          className="absolute inset-0 cursor-pointer"
          onClick={handleClickEmpty}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleAddDates();
          }}
        >
          <div className="absolute inset-0 hidden items-center justify-center group-hover/lane:flex">
            <span className="flex items-center gap-1 rounded border border-dashed border-border-subtle px-2 py-0.5 text-[11px] text-fg-muted hover:border-[var(--accent)] hover:text-[var(--accent)] dark:hover:text-[var(--accent)]">
              <Plus size={12} />
              设置时间
            </span>
          </div>
        </button>
      )}
    </div>
  );
}
