import { cn } from "@tokiomo/components";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(
    null,
  );

  const dateFieldId = activeView?.calendarConfig?.dateFieldId ?? "";
  const dateField = fields.find((f) => f.id === dateFieldId);

  // Drag state
  const [dragState, setDragState] = useState<{
    recordId: string;
    startX: number;
    startY: number;
    isDragging: boolean;
    ghostEl: HTMLElement | null;
  } | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const dropTargetDateRef = useRef<string | null>(null);
  const dragJustEndedRef = useRef(false);

  const handleDragStart = useCallback(
    (recordId: string, e: React.PointerEvent) => {
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;

      const ghost = document.createElement("div");
      ghost.style.cssText = `
        position: fixed;
        z-index: 99999;
        pointer-events: none;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 10px;
        background: rgba(59, 130, 246, 0.15);
        color: #3b82f6;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        opacity: 0;
      `;
      ghost.textContent = target.textContent || "未命名";
      document.body.appendChild(ghost);
      ghost.style.left = `${e.clientX - 20}px`;
      ghost.style.top = `${e.clientY - 10}px`;

      setDragState({
        recordId,
        startX: e.clientX,
        startY: e.clientY,
        isDragging: false,
        ghostEl: ghost,
      });
    },
    [],
  );

  useEffect(() => {
    if (!dragState) return;

    const handleMove = (e: PointerEvent) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const moved = Math.abs(dx) + Math.abs(dy) > 5;

      if (moved && !dragState.isDragging) {
        setDragState((prev) => (prev ? { ...prev, isDragging: true } : null));
        if (dragState.ghostEl) {
          dragState.ghostEl.style.opacity = "1";
        }
      }

      if (dragState.ghostEl) {
        dragState.ghostEl.style.left = `${e.clientX - 20}px`;
        dragState.ghostEl.style.top = `${e.clientY - 10}px`;
      }

      // Find drop target using elementsFromPoint (works through pointer-events: none layers)
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      let targetDate: string | null = null;
      for (const el of elements) {
        const dateAttr = (el as HTMLElement).dataset?.date;
        if (dateAttr) {
          targetDate = dateAttr;
          break;
        }
      }
      dropTargetDateRef.current = targetDate;
      setDropTargetDate(targetDate);
    };

    const handleUp = (e: PointerEvent) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const wasDrag = Math.abs(dx) + Math.abs(dy) > 5;

      if (dragState.ghostEl) {
        document.body.removeChild(dragState.ghostEl);
      }

      if (wasDrag && dropTargetDateRef.current && dateFieldId) {
        state.updateCell(
          dragState.recordId,
          dateFieldId,
          dropTargetDateRef.current,
        );
        dragJustEndedRef.current = true;
      } else if (!wasDrag) {
        // It was a click — open the popover
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const buttonEl = elements.find((el) => el.tagName === "BUTTON") as
          | HTMLElement
          | undefined;
        if (buttonEl) {
          setPopoverAnchorEl(buttonEl);
          setSelectedRecordId(dragState.recordId);
        }
      }

      setDragState(null);
      setDropTargetDate(null);
      dropTargetDateRef.current = null;
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    return () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
    };
  }, [dragState, state, dateFieldId]);

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
                  onDragStart={handleDragStart}
                  isDropTarget={dropTargetDate === day.dateStr}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Record popover */}
      {selectedRecord && popoverAnchorEl && (
        <CalendarRecordPopover
          record={selectedRecord}
          fields={fields}
          anchorEl={popoverAnchorEl}
          onClose={() => {
            setSelectedRecordId(null);
            setPopoverAnchorEl(null);
          }}
          onUpdateCell={(fieldId, value) =>
            state.updateCell(selectedRecord.id, fieldId, value)
          }
        />
      )}
    </div>
  );
}
