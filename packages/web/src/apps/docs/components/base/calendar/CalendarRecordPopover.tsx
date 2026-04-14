import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { BaseRecord, CellValue, Field } from "../types";
import { FIELD_TYPE_LABELS } from "../utils";

interface CalendarRecordPopoverProps {
  record: BaseRecord;
  fields: Field[];
  position: { top: number; left: number };
  onClose: () => void;
  onUpdateCell: (fieldId: string, value: CellValue) => void;
}

export function CalendarRecordPopover({
  record,
  fields,
  position,
  onClose,
  onUpdateCell,
}: CalendarRecordPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Clamp position to viewport
  const clampedTop = Math.min(position.top, window.innerHeight - 360);
  const clampedLeft = Math.min(position.left, window.innerWidth - 320);

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] w-80 rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[rgba(38,38,58,0.88)] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      style={{ top: clampedTop, left: clampedLeft }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <span className="text-xs font-medium text-fg-primary">记录详情</span>
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
    </div>,
    document.body,
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
      className="w-full rounded border border-border-subtle bg-surface-base px-2 py-1 text-xs text-fg-primary outline-none focus:border-blue-400"
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
