import { cn } from "@tokiomo/components";
import { useMemo } from "react";
import type { Field, SelectOption } from "../types";
import type { BaseEditorState } from "../useBaseEditor";

interface GalleryCardProps {
  record: { id: string; data: Record<string, unknown> };
  state: BaseEditorState;
}

export function GalleryCard({ record, state }: GalleryCardProps) {
  const { activeView, fields } = state;
  const config = activeView?.galleryConfig;

  const titleField = useMemo(
    () =>
      fields.find((f) => f.id === config?.titleFieldId) ??
      fields.find((f) => f.type === "text"),
    [fields, config?.titleFieldId],
  );

  const cardFields = useMemo(() => {
    if (!config) return [];
    const visibleIds = new Set(config.cardVisibleFieldIds);
    return fields.filter(
      (f) => visibleIds.has(f.id) && f.id !== titleField?.id,
    );
  }, [config, fields, titleField]);

  const title = titleField ? String(record.data[titleField.id] ?? "") : "";

  // Cover image — look for attachment field value (URL string or first URL in array)
  const coverUrl = useMemo(() => {
    if (!config?.coverFieldId) return null;
    const val = record.data[config.coverFieldId];
    if (typeof val === "string" && val) return val;
    if (Array.isArray(val) && val.length > 0) return String(val[0]);
    return null;
  }, [config?.coverFieldId, record.data]);

  return (
    <div className="cursor-pointer overflow-hidden rounded-lg border border-border-subtle bg-surface-base transition-shadow hover:shadow-md">
      {/* Cover image area */}
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden bg-fill-tertiary",
          config?.cardSize === "small"
            ? "h-28"
            : config?.cardSize === "large"
              ? "h-52"
              : "h-40",
        )}
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-fg-muted/30">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>
        )}
      </div>

      {/* Card content */}
      <div className="p-3">
        <div className="truncate text-sm font-medium">
          {title || <span className="text-fg-muted">无标题</span>}
        </div>
        {cardFields.length > 0 && (
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
                <div key={field.id}>
                  <GalleryFieldValue field={field} value={value} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryFieldValue({ field, value }: { field: Field; value: unknown }) {
  switch (field.type) {
    case "select":
    case "workflow": {
      const opt = (field.options ?? []).find(
        (o: SelectOption) => o.id === value,
      );
      return opt ? (
        <span
          className="inline-block rounded-full px-2 py-0.5 text-xs"
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
                className="inline-block rounded-full px-2 py-0.5 text-xs"
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
      return (
        <span className="text-xs text-fg-muted">
          {value === true ? "✓" : "✗"}
        </span>
      );
    case "rating": {
      const n = typeof value === "number" ? value : 0;
      return (
        <span className="text-xs text-yellow-500">
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
          <span className="text-[10px] text-fg-muted">{pct}%</span>
        </div>
      );
    }
    case "member": {
      const members = Array.isArray(value) ? value : [value];
      return (
        <span className="text-xs text-fg-muted">{members.join(", ")}</span>
      );
    }
    default:
      return (
        <span className="truncate text-xs text-fg-muted">
          {String(value ?? "")}
        </span>
      );
  }
}
