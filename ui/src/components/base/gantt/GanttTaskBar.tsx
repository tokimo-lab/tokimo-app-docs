import { useCallback, useEffect, useRef, useState } from "react";
import { daysBetween, toDateStr } from "../utils";

interface GanttTaskBarProps {
  startDate: string;
  endDate: string;
  title: string;
  firstDateStr: string;
  barColor: string;
  rowHeight: number;
  colWidth: number;
  recordId: string;
  onSetDates: (recordId: string, start: string, end: string) => void;
}

type DragMode = "move" | "resize-left" | "resize-right";

interface DragState {
  mode: DragMode;
  startX: number;
  origStartDays: number;
  origEndDays: number;
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr.slice(0, 10));
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

const HANDLE_WIDTH = 6;

export function GanttTaskBar({
  startDate,
  endDate,
  title,
  firstDateStr,
  barColor,
  rowHeight,
  colWidth,
  recordId,
  onSetDates,
}: GanttTaskBarProps) {
  const firstDate = new Date(firstDateStr);
  const start = new Date(startDate.slice(0, 10));
  const origOffsetDays = Math.round(
    (start.getTime() - firstDate.getTime()) / 86400000,
  );
  const origDuration = daysBetween(
    startDate.slice(0, 10),
    endDate.slice(0, 10),
  );
  const barHeight = 24;
  const top = (rowHeight - barHeight) / 2;

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const dragRef = useRef<DragState | null>(null);

  const deltaDays = dragState ? Math.round(dragDelta / colWidth) : 0;

  let displayLeft: number;
  let displayWidth: number;
  let displayDuration: number;

  if (dragState) {
    if (dragState.mode === "move") {
      displayLeft = (origOffsetDays + deltaDays) * colWidth;
      displayWidth = origDuration * colWidth;
      displayDuration = origDuration;
    } else if (dragState.mode === "resize-left") {
      const newOffset = origOffsetDays + deltaDays;
      const maxOffset = origOffsetDays + origDuration - 1;
      const clampedOffset = Math.min(newOffset, maxOffset);
      displayLeft = clampedOffset * colWidth;
      displayDuration = origDuration - (clampedOffset - origOffsetDays);
      displayWidth = displayDuration * colWidth;
    } else {
      const newDuration = origDuration + deltaDays;
      const clampedDuration = Math.max(1, newDuration);
      displayLeft = origOffsetDays * colWidth;
      displayDuration = clampedDuration;
      displayWidth = clampedDuration * colWidth;
    }
  } else {
    displayLeft = origOffsetDays * colWidth;
    displayWidth = origDuration * colWidth;
    displayDuration = origDuration;
  }

  const commitDrag = useCallback(() => {
    const ds = dragRef.current;
    if (!ds) return;
    const delta = Math.round(dragDelta / colWidth);
    if (delta === 0) {
      setDragState(null);
      setDragDelta(0);
      dragRef.current = null;
      return;
    }

    let newStart: string;
    let newEnd: string;

    if (ds.mode === "move") {
      newStart = addDaysToDate(startDate, delta);
      newEnd = addDaysToDate(endDate, delta);
    } else if (ds.mode === "resize-left") {
      const maxDelta = origDuration - 1;
      const clamped = Math.min(delta, maxDelta);
      newStart = addDaysToDate(startDate, clamped);
      newEnd = endDate.slice(0, 10);
    } else {
      const minDelta = -(origDuration - 1);
      const clamped = Math.max(delta, minDelta);
      newStart = startDate.slice(0, 10);
      newEnd = addDaysToDate(endDate, clamped);
    }

    onSetDates(recordId, newStart, newEnd);
    setDragState(null);
    setDragDelta(0);
    dragRef.current = null;
  }, [
    dragDelta,
    colWidth,
    startDate,
    endDate,
    origDuration,
    recordId,
    onSetDates,
  ]);

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragDelta(e.clientX - (dragRef.current?.startX ?? 0));
    };

    const handleMouseUp = () => {
      commitDrag();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, commitDrag]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = e.currentTarget.getBoundingClientRect();
      const localX = e.clientX - rect.left;

      let mode: DragMode;
      if (localX <= HANDLE_WIDTH) {
        mode = "resize-left";
      } else if (localX >= rect.width - HANDLE_WIDTH) {
        mode = "resize-right";
      } else {
        mode = "move";
      }

      const state: DragState = {
        mode,
        startX: e.clientX,
        origStartDays: origOffsetDays,
        origEndDays: origOffsetDays + origDuration,
      };
      dragRef.current = state;
      setDragState(state);
      setDragDelta(0);
    },
    [origOffsetDays, origDuration],
  );

  if (displayLeft + displayWidth < 0) return null;

  const isDragging = dragState !== null;
  const cursorClass = isDragging
    ? dragState.mode === "move"
      ? "cursor-grabbing"
      : "cursor-col-resize"
    : "cursor-grab";

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-valuenow={origOffsetDays}
      aria-label={title}
      className={`absolute flex items-center overflow-hidden rounded text-[11px] font-medium text-white shadow-sm select-none ${cursorClass}`}
      style={{
        left: displayLeft,
        width: Math.max(displayWidth, colWidth / 2),
        height: barHeight,
        top,
        backgroundColor: barColor,
        opacity: isDragging ? 0.85 : undefined,
        zIndex: isDragging ? 20 : undefined,
      }}
      title={`${title} (${displayDuration}天)`}
      onMouseDown={handleMouseDown}
    >
      {/* Left resize handle */}
      <div
        className="absolute top-0 left-0 bottom-0 cursor-col-resize"
        style={{ width: HANDLE_WIDTH }}
      />
      {/* Bar content */}
      <div className="flex min-w-0 flex-1 items-center px-1.5">
        <span className="truncate">{title}</span>
        {displayWidth > 60 && (
          <span className="ml-auto shrink-0 pl-1 text-[10px] opacity-80">
            {displayDuration}天
          </span>
        )}
      </div>
      {/* Right resize handle */}
      <div
        className="absolute top-0 right-0 bottom-0 cursor-col-resize"
        style={{ width: HANDLE_WIDTH }}
      />
    </div>
  );
}
