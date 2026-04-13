import { cn } from "@tokiomo/components";
import { useState } from "react";
import type { FieldType } from "./types";
import { FIELD_TYPE_LABELS } from "./utils";

interface FieldConfigPanelProps {
  open: boolean;
  onClose: () => void;
  onAddField: (name: string, type: FieldType) => void;
}

const FIELD_TYPES: FieldType[] = [
  "text",
  "number",
  "select",
  "multiSelect",
  "checkbox",
  "date",
  "url",
];

export function FieldConfigPanel({
  open,
  onClose,
  onAddField,
}: FieldConfigPanelProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");

  if (!open) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAddField(name.trim(), type);
    setName("");
    setType("text");
    onClose();
  };

  return (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full right-0 z-50 mt-1 w-64 rounded-lg border border-border-base bg-surface-base p-3 shadow-lg">
        <div className="mb-2 text-xs font-medium text-fg-secondary">
          新增字段
        </div>
        <input
          className="mb-2 w-full rounded border border-border-base bg-surface-secondary px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="字段名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
        />
        <div className="mb-3 grid grid-cols-2 gap-1">
          {FIELD_TYPES.map((ft) => (
            <button
              key={ft}
              type="button"
              className={cn(
                "rounded px-2 py-1 text-xs transition-colors cursor-pointer",
                type === ft
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "text-fg-secondary hover:bg-fill-tertiary",
              )}
              onClick={() => setType(ft)}
            >
              {FIELD_TYPE_LABELS[ft]}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded px-3 py-1 text-xs text-fg-muted hover:bg-fill-tertiary cursor-pointer"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 cursor-pointer"
            onClick={handleSubmit}
          >
            添加
          </button>
        </div>
      </div>
    </>
  );
}
