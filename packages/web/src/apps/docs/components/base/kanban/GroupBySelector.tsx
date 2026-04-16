import { cn } from "@tokiomo/components";
import { Check } from "lucide-react";
import type { Field } from "../types";
import { FIELD_TYPE_LABELS, KANBAN_GROUPABLE_TYPES } from "../utils";

interface GroupBySelectorProps {
  fields: Field[];
  selectedFieldId: string;
  onSelect: (fieldId: string) => void;
  onClose: () => void;
}

export function GroupBySelector({
  fields,
  selectedFieldId,
  onSelect,
  onClose,
}: GroupBySelectorProps) {
  const groupableFields = fields.filter((f) =>
    KANBAN_GROUPABLE_TYPES.includes(f.type),
  );

  return (
    <div
      className="w-52 py-1"
      style={{ animation: "toolbar-popup-in 150ms ease-out" }}
    >
      <div className="px-3 py-1.5 text-xs font-medium text-fg-muted">
        选择分组依据
      </div>
      {groupableFields.map((field) => (
        <button
          key={field.id}
          type="button"
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary",
            field.id === selectedFieldId && "text-[var(--accent)]",
          )}
          onClick={() => onSelect(field.id)}
        >
          <span className="flex-1">{field.name}</span>
          <span className="text-fg-muted">{FIELD_TYPE_LABELS[field.type]}</span>
          {field.id === selectedFieldId && <Check size={14} />}
        </button>
      ))}
      {groupableFields.length === 0 && (
        <div className="px-3 py-2 text-xs text-fg-muted">无可分组字段</div>
      )}
    </div>
  );
}
