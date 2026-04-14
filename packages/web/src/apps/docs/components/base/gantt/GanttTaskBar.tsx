import { daysBetween } from "../utils";

interface GanttTaskBarProps {
  startDate: string;
  endDate: string;
  title: string;
  firstDateStr: string;
  barColor: string;
  rowHeight: number;
  colWidth: number;
}

export function GanttTaskBar({
  startDate,
  endDate,
  title,
  firstDateStr,
  barColor,
  rowHeight,
  colWidth,
}: GanttTaskBarProps) {
  const firstDate = new Date(firstDateStr);
  const start = new Date(startDate.slice(0, 10));
  const offsetDays = Math.round(
    (start.getTime() - firstDate.getTime()) / 86400000,
  );
  const duration = daysBetween(startDate.slice(0, 10), endDate.slice(0, 10));
  const left = offsetDays * colWidth;
  const width = duration * colWidth;
  const barHeight = 24;
  const top = (rowHeight - barHeight) / 2;

  if (left + width < 0) return null;

  return (
    <div
      className="absolute flex items-center overflow-hidden rounded px-1.5 text-[11px] font-medium text-white shadow-sm transition-opacity hover:opacity-90"
      style={{
        left,
        width: Math.max(width, colWidth / 2),
        height: barHeight,
        top,
        backgroundColor: barColor,
      }}
      title={`${title} (${duration}天)`}
    >
      <span className="truncate">{title}</span>
      {width > 60 && (
        <span className="ml-auto shrink-0 pl-1 text-[10px] opacity-80">
          {duration}天
        </span>
      )}
    </div>
  );
}
