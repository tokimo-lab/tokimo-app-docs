import {
  autoUpdate,
  FloatingPortal,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { cn, FloatingVibrancy } from "@tokimo/ui";
import { X } from "lucide-react";
import type { BaseRecord, CellValue, Field } from "../types";
import { FIELD_TYPE_LABELS } from "../utils";

interface CalendarRecordPopoverProps {
  record: BaseRecord;
  fields: Field[];
  anchorEl: HTMLElement;
  onClose: () => void;
  onUpdateCell: (fieldId: string, value: CellValue) => void;
}

export function CalendarRecordPopover({
  record,
  fields,
  anchorEl,
  onClose,
  onUpdateCell,
}: CalendarRecordPopoverProps) {
  const { refs, floatingStyles, context } = useFloating({
    open: true,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
    placement: "bottom-start",
    elements: { reference: anchorEl },
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: (...args) => autoUpdate(...args),
  });

  const dismiss = useDismiss(context);
  const role = useRole(context);
  const { getFloatingProps } = useInteractions([dismiss, role]);

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={{
          ...floatingStyles,
          backdropFilter: "blur(var(--window-blur, 24px))",
          WebkitBackdropFilter: "blur(var(--window-blur, 24px))",
          borderRadius: "var(--window-radius, 10px)",
        }}
        className={cn(
          "z-[9999] w-80 overflow-hidden border shadow-lg ring-1 select-none",
          "bg-[rgba(255,255,255,calc(var(--window-opacity,85)/100))] border-black/[0.06] ring-black/5",
          "dark:bg-[rgba(15,15,25,calc(var(--window-opacity,85)/100))] dark:border-white/[0.08] dark:shadow-black/40 dark:ring-white/5",
        )}
        {...getFloatingProps()}
      >
        <FloatingVibrancy />
        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
            <span className="text-xs font-medium text-fg-primary">
              记录详情
            </span>
            <button
              type="button"
              className="cursor-pointer rounded p-0.5 text-fg-muted hover:bg-fill-tertiary"
              onClick={onClose}
            >
              <X size={14} />
            </button>
          </div>

          {/* Fields */}
          <div className="max-h-72 overflow-y-auto p-3">
            <div className="flex flex-col gap-3">
              {fields.map((field) => {
                const value = record.data[field.id];
                return (
                  <div key={field.id}>
                    <div className="mb-1 text-[10px] text-fg-muted">
                      {field.name}
                      <span className="ml-1 text-fg-disabled">
                        ({FIELD_TYPE_LABELS[field.type]})
                      </span>
                    </div>
                    <FieldValueDisplay
                      field={field}
                      value={value}
                      onUpdate={(v) => onUpdateCell(field.id, v)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </FloatingPortal>
  );
}

function FieldValueDisplay({
  field,
  value,
  onUpdate,
}: {
  field: Field;
  value: CellValue;
  onUpdate: (v: CellValue) => void;
}) {
  const isReadonly = [
    "autoNumber",
    "createdBy",
    "modifiedBy",
    "createdTime",
    "modifiedTime",
  ].includes(field.type);

  if (field.type === "checkbox") {
    return (
      <input
        type="checkbox"
        className="cursor-pointer"
        checked={value === true}
        onChange={(e) => onUpdate(e.target.checked)}
      />
    );
  }

  if (field.type === "select" || field.type === "workflow") {
    const options = field.options ?? [];
    const selected = typeof value === "string" ? value : "";
    return (
      <select
        className="w-full rounded border border-border-subtle bg-surface-base px-2 py-1 text-xs text-fg-primary"
        value={selected}
        onChange={(e) => onUpdate(e.target.value)}
        disabled={isReadonly}
      >
        <option value="">--</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "multiSelect") {
    const options = field.options ?? [];
    const selectedIds = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const isSelected = selectedIds.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              className="cursor-pointer rounded-full px-2 py-0.5 text-[10px] transition-opacity"
              style={{
                backgroundColor: isSelected ? opt.color : "transparent",
                border: `1px solid ${opt.color}`,
                opacity: isSelected ? 1 : 0.4,
              }}
              onClick={() => {
                const next = isSelected
                  ? selectedIds.filter((id) => id !== opt.id)
                  : [...selectedIds, opt.id];
                onUpdate(next);
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (field.type === "rating") {
    const num = typeof value === "number" ? value : 0;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            className="cursor-pointer text-sm"
            onClick={() => onUpdate(i === num ? 0 : i)}
          >
            {i <= num ? "★" : "☆"}
          </button>
        ))}
      </div>
    );
  }

  if (field.type === "progress") {
    const num = typeof value === "number" ? value : 0;
    return (
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          value={num}
          className="flex-1"
          onChange={(e) => onUpdate(Number(e.target.value))}
          disabled={isReadonly}
        />
        <span className="w-8 text-right text-xs text-fg-muted">{num}%</span>
      </div>
    );
  }

  // Text-like fields
  const strVal = value == null ? "" : String(value);
  if (isReadonly) {
    return (
      <div className="rounded bg-fill-quaternary px-2 py-1 text-xs text-fg-muted">
        {strVal || "--"}
      </div>
    );
  }

  return (
    <input
      type={
        field.type === "number" || field.type === "currency" ? "number" : "text"
      }
      className="w-full rounded border border-border-subtle bg-surface-base px-2 py-1 text-xs text-fg-primary outline-none focus:border-[var(--accent)]"
      value={strVal}
      onChange={(e) => {
        const v =
          field.type === "number" || field.type === "currency"
            ? Number(e.target.value) || null
            : e.target.value;
        onUpdate(v);
      }}
    />
  );
}
