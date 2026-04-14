import { cn } from "@tokiomo/components";
import {
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { BaseRecord } from "../types";
import type { BaseEditorState } from "../useBaseEditor";
import {
  applyGroups,
  getMonthDays,
  getProcessedRecords,
  toDateStr,
} from "../utils";
import { GanttRecordList } from "./GanttRecordList";
import { GanttTimeline } from "./GanttTimeline";

interface GanttViewProps {
  state: BaseEditorState;
}

export type GanttRow =
  | { type: "group"; key: string; label: string; count: number }
  | { type: "record"; record: BaseRecord; index: number };

const ROW_HEIGHT = 36;
const COL_WIDTH = 40;

export function GanttView({ state }: GanttViewProps) {
  const { activeView, fields, records } = state;
  const [collapsed, setCollapsed] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const ganttConfig = activeView?.ganttConfig;
  const startFieldId = ganttConfig?.startDateFieldId ?? "";
  const endFieldId = ganttConfig?.endDateFieldId ?? "";
  const titleFieldId = ganttConfig?.titleFieldId ?? "";
  const startField = fields.find((f) => f.id === startFieldId);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = useMemo(() => getMonthDays(year, month), [year, month]);

  const processedRecords = useMemo(
    () =>
      activeView ? getProcessedRecords(records, activeView, fields) : records,
    [records, activeView, fields],
  );

  const groupedRecords = useMemo(
    () =>
      activeView
        ? applyGroups(processedRecords, activeView.groups, fields)
        : [{ key: "__all", label: "", records: processedRecords }],
    [processedRecords, activeView, fields],
  );

  const rows = useMemo(() => {
    const result: GanttRow[] = [];
    let idx = 0;
    const hasGroups =
      groupedRecords.length > 1 ||
      (groupedRecords.length === 1 && groupedRecords[0].key !== "__all");
    for (const g of groupedRecords) {
      if (hasGroups) {
        result.push({
          type: "group",
          key: g.key,
          label: g.label,
          count: g.records.length,
        });
      }
      for (const rec of g.records) {
        idx++;
        result.push({ type: "record", record: rec, index: idx });
      }
    }
    return result;
  }, [groupedRecords]);

  const visibleRows = useMemo(() => {
    let curGroup = "";
    return rows.filter((row) => {
      if (row.type === "group") {
        curGroup = row.key;
        return true;
      }
      return !collapsedGroups.has(curGroup);
    });
  }, [rows, collapsedGroups]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSyncScroll = useCallback((source: "left" | "right") => {
    const from = source === "left" ? leftRef.current : rightRef.current;
    const to = source === "left" ? rightRef.current : leftRef.current;
    if (from && to) {
      to.scrollTop = from.scrollTop;
    }
  }, []);

  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const goNext = () => setCurrentDate(new Date(year, month + 1, 1));

  const todayStr = toDateStr(new Date());

  if (!startField) {
    return (
      <div className="flex h-full items-center justify-center text-fg-muted">
        <div className="text-center">
          <p className="text-sm">请先配置日期字段</p>
          <p className="mt-1 text-xs">
            在工具栏点击「甘特图配置」选择开始和结束日期字段
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
        <div className="flex items-center rounded border border-border-subtle text-xs">
          {(["week", "month", "quarter", "year"] as const).map((scale) => (
            <button
              key={scale}
              type="button"
              className={cn(
                "cursor-pointer px-2 py-0.5 transition-colors",
                ganttConfig?.timeScale === scale
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                  : "text-fg-muted hover:bg-fill-tertiary",
              )}
              onClick={() => state.setGanttConfig({ timeScale: scale })}
            >
              {scale === "week"
                ? "周"
                : scale === "month"
                  ? "月"
                  : scale === "quarter"
                    ? "季"
                    : "年"}
            </button>
          ))}
        </div>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        {!collapsed && (
          <div className="relative flex w-[280px] shrink-0 flex-col border-r border-border-subtle">
            <button
              type="button"
              className="absolute top-1 right-1 z-10 cursor-pointer rounded p-0.5 text-fg-muted hover:bg-fill-tertiary"
              onClick={() => setCollapsed(true)}
              title="收起列表"
            >
              <PanelLeftClose size={14} />
            </button>
            <div className="h-[56px] shrink-0 border-b border-border-subtle" />
            <div
              ref={leftRef}
              className="flex-1 overflow-y-auto overflow-x-hidden"
              onScroll={() => handleSyncScroll("left")}
            >
              <GanttRecordList
                rows={visibleRows}
                titleFieldId={titleFieldId}
                fields={fields}
                collapsedGroups={collapsedGroups}
                onToggleGroup={toggleGroup}
                onAddRecord={state.addRecord}
                rowHeight={ROW_HEIGHT}
              />
            </div>
          </div>
        )}

        {collapsed && (
          <div className="flex w-8 shrink-0 flex-col items-center border-r border-border-subtle pt-2">
            <button
              type="button"
              className="cursor-pointer rounded p-0.5 text-fg-muted hover:bg-fill-tertiary"
              onClick={() => setCollapsed(false)}
              title="展开列表"
            >
              <PanelLeftOpen size={14} />
            </button>
          </div>
        )}

        {/* Right panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <GanttTimeline
            ref={rightRef}
            days={days}
            rows={visibleRows}
            year={year}
            month={month}
            todayStr={todayStr}
            startFieldId={startFieldId}
            endFieldId={endFieldId}
            titleFieldId={titleFieldId}
            fields={fields}
            barColor={ganttConfig?.customColor ?? "#3b82f6"}
            rowHeight={ROW_HEIGHT}
            colWidth={COL_WIDTH}
            onSyncScroll={() => handleSyncScroll("right")}
            onSetDates={state.updateRecordDates}
          />
        </div>
      </div>
    </div>
  );
}
