import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { Field } from "../types";
import type { GanttRow } from "./GanttView";

interface GanttRecordListProps {
  rows: GanttRow[];
  titleFieldId: string;
  fields: Field[];
  collapsedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  onAddRecord: () => void;
  rowHeight: number;
}

export function GanttRecordList({
  rows,
  titleFieldId,
  fields,
  collapsedGroups,
  onToggleGroup,
  onAddRecord,
  rowHeight,
}: GanttRecordListProps) {
  const titleField = fields.find((f) => f.id === titleFieldId);

  return (
    <div>
      {rows.map((row) => {
        if (row.type === "group") {
          const isCollapsed = collapsedGroups.has(row.key);
          return (
            <div
              key={`g-${row.key}`}
              className="flex items-center gap-1.5 border-b border-border-subtle bg-fill-secondary/50 px-2 dark:bg-fill-secondary/30"
              style={{ height: rowHeight }}
            >
              <button
                type="button"
                className="cursor-pointer rounded p-0.5 text-fg-muted hover:bg-fill-tertiary"
                onClick={() => onToggleGroup(row.key)}
              >
                {isCollapsed ? (
                  <ChevronRight size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>
              <span
                className="inline-block h-2 w-2 rounded-full bg-accent"
                aria-hidden
              />
              <span className="truncate text-xs font-medium text-fg-primary">
                {row.label}
              </span>
              <span className="text-[10px] text-fg-muted">{row.count}</span>
            </div>
          );
        }

        const title = titleField
          ? String(row.record.data[titleFieldId] ?? "")
          : "";

        return (
          <div
            key={row.record.id}
            className="flex items-center gap-2 border-b border-border-subtle px-2 text-xs text-fg-secondary hover:bg-fill-tertiary/50"
            style={{ height: rowHeight }}
          >
            <span className="w-6 shrink-0 text-right text-[10px] text-fg-muted">
              {row.index}
            </span>
            <span className="truncate">{title || "无标题"}</span>
          </div>
        );
      })}

      <div className="px-2 py-1.5">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent-subtle)] dark:text-[var(--accent)] dark:hover:bg-[var(--accent-subtle)]"
          onClick={onAddRecord}
        >
          <Plus size={14} />
          添加记录
        </button>
      </div>
    </div>
  );
}
