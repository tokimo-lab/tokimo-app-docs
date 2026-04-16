import { cn } from "@tokiomo/components";
import { useCallback, useMemo } from "react";
import type { Field, SelectOption } from "../types";
import type { BaseEditorState } from "../useBaseEditor";

interface KanbanCardProps {
  record: { id: string; data: Record<string, unknown> };
  state: BaseEditorState;
  groupId?: string;
  isDragging?: boolean;
  onPointerDragStart?: (
    recordId: string,
    sourceGroupId: string,
    title: string,
    cardRect: DOMRect,
    startX: number,
    startY: number,
  ) => void;
}

export function KanbanCard({
  record,
  state,
  groupId,
  isDragging,
  onPointerDragStart,
}: KanbanCardProps) {
  const { activeView, fields } = state;
  const config = activeView?.kanbanConfig;

  const primaryField = useMemo(
    () => fields.find((f) => f.type === "text"),
    [fields],
  );

  const cardFields = useMemo(() => {
    if (!config) return [];
    const visibleIds = new Set(config.cardVisibleFieldIds);
    return fields.filter(
      (f) =>
        visibleIds.has(f.id) &&
        f.id !== primaryField?.id &&
        f.id !== config.groupFieldId,
    );
  }, [config, fields, primaryField]);

  const title = primaryField ? String(record.data[primaryField.id] ?? "") : "";
  const isCompact = config?.cardDisplayMode === "compact";
  const showNames = config?.showFieldNames ?? false;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      onPointerDragStart?.(
        record.id,
        groupId ?? "",
        title,
        rect,
        e.clientX,
        e.clientY,
      );
    },
    [record.id, groupId, title, onPointerDragStart],
  );

  return (
    <div
      onPointerDown={handlePointerDown}
      className={cn(
        "cursor-grab rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-white/[0.06] p-3 transition-shadow hover:shadow-sm select-none",
        isDragging && "opacity-40 cursor-grabbing",
      )}
    >
      <div className="truncate text-sm font-medium">
        {title || <span className="text-fg-muted">未命名记录</span>}
      </div>
      {!isCompact && cardFields.length > 0 && (
        <div className="mt-2 space-y-1">
          {cardFields.map((field) => {
            const value = record.data[field.id];
            if (
              value === null ||
              value === undefined ||
              value === "" ||
              (Array.isArray(value) && value.length === 0)
            )
              return null;
            return (
              <div key={field.id} className="flex items-center gap-1 text-xs">
                {showNames && (
                  <span className="shrink-0 text-fg-muted">{field.name}：</span>
                )}
                <CardFieldValue field={field} value={value} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardFieldValue({ field, value }: { field: Field; value: unknown }) {
  switch (field.type) {
    case "select":
    case "workflow": {
      const opt = (field.options ?? []).find(
        (o: SelectOption) => o.id === value,
      );
      return opt ? (
        <span
          className="inline-block rounded-full px-1.5 py-0.5 text-xs"
          style={{ backgroundColor: opt.color }}
        >
          {opt.label}
        </span>
      ) : null;
    }
    case "multiSelect": {
      const ids = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-1">
          {ids.map((id: string) => {
            const opt = (field.options ?? []).find(
              (o: SelectOption) => o.id === id,
            );
            return opt ? (
              <span
                key={id}
                className="inline-block rounded-full px-1.5 py-0.5 text-xs"
                style={{ backgroundColor: opt.color }}
              >
                {opt.label}
              </span>
            ) : null;
          })}
        </div>
      );
    }
    case "checkbox":
      return <span>{value === true ? "✓" : "✗"}</span>;
    case "rating": {
      const n = typeof value === "number" ? value : 0;
      return (
        <span className="text-yellow-500">
          {"★".repeat(n)}
          {"☆".repeat(5 - n)}
        </span>
      );
    }
    case "progress": {
      const pct = typeof value === "number" ? value : 0;
      return (
        <div className="flex items-center gap-1">
          <div className="h-1 w-16 rounded-full bg-fill-tertiary">
            <div
              className="h-full rounded-full bg-[var(--accent-subtle)]0"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-fg-muted">{pct}%</span>
        </div>
      );
    }
    case "member": {
      const members = Array.isArray(value) ? value : [value];
      return <span className="text-fg-muted">{members.join(", ")}</span>;
    }
    default:
      return (
        <span className="truncate text-fg-muted">{String(value ?? "")}</span>
      );
  }
}
