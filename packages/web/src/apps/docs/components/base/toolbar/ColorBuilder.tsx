import { cn } from "@tokiomo/components";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ColorRule, Field, FilterOperator } from "../types";
import { ROW_COLORS as COLORS } from "../types";

const OPERATOR_OPTIONS: { key: FilterOperator; label: string }[] = [
  { key: "eq", label: "等于" },
  { key: "neq", label: "不等于" },
  { key: "contains", label: "包含" },
  { key: "notContains", label: "不包含" },
  { key: "isEmpty", label: "为空" },
  { key: "isNotEmpty", label: "不为空" },
];

function generateId() {
  return `cr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface ColorBuilderProps {
  rules: ColorRule[];
  fields: Field[];
  onChange: (rules: ColorRule[]) => void;
  onClose: () => void;
}

export function ColorBuilder({
  rules,
  fields,
  onChange,
  onClose,
}: ColorBuilderProps) {
  const addRule = () => {
    const firstField = fields[0];
    if (!firstField) return;
    onChange([
      ...rules,
      {
        id: generateId(),
        fieldId: firstField.id,
        operator: "isNotEmpty",
        value: null,
        colorId: COLORS[rules.length % COLORS.length].id,
      },
    ]);
  };

  const updateRule = (id: string, patch: Partial<ColorRule>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
  };

  const needsValue = (op: FilterOperator) =>
    op !== "isEmpty" && op !== "isNotEmpty";

  return (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="relative z-50 min-w-[340px] rounded-lg border border-border-base bg-surface-base p-3 shadow-lg">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-fg-secondary">填色</span>
          <button
            type="button"
            className="cursor-pointer text-xs text-fg-muted hover:text-fg-secondary"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {rules.length === 0 && (
          <div className="mb-2 text-xs text-fg-muted">
            添加规则，为符合条件的记录着色
          </div>
        )}

        <div className="flex flex-col gap-2">
          {rules.map((rule) => (
            <ColorRuleRow
              key={rule.id}
              rule={rule}
              fields={fields}
              needsValue={needsValue(rule.operator)}
              onUpdate={(patch) => updateRule(rule.id, patch)}
              onRemove={() => removeRule(rule.id)}
            />
          ))}
        </div>

        <button
          type="button"
          className="mt-2 flex cursor-pointer items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
          onClick={addRule}
        >
          <Plus size={12} />
          添加着色规则
        </button>
      </div>
    </>
  );
}

interface ColorRuleRowProps {
  rule: ColorRule;
  fields: Field[];
  needsValue: boolean;
  onUpdate: (patch: Partial<ColorRule>) => void;
  onRemove: () => void;
}

function ColorRuleRow({
  rule,
  fields,
  needsValue,
  onUpdate,
  onRemove,
}: ColorRuleRowProps) {
  const field = fields.find((f) => f.id === rule.fieldId);
  const isSelectField =
    field?.type === "select" || field?.type === "multiSelect";

  return (
    <div className="flex items-center gap-1.5">
      {/* Color picker */}
      <ColorDot
        colorId={rule.colorId}
        onChange={(colorId) => onUpdate({ colorId })}
      />

      {/* Field select */}
      <select
        className="h-7 max-w-[90px] rounded border border-border-base bg-surface-secondary px-1.5 text-xs outline-none"
        value={rule.fieldId}
        onChange={(e) => onUpdate({ fieldId: e.target.value, value: null })}
      >
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>

      {/* Operator */}
      <select
        className="h-7 max-w-[80px] rounded border border-border-base bg-surface-secondary px-1.5 text-xs outline-none"
        value={rule.operator}
        onChange={(e) =>
          onUpdate({ operator: e.target.value as FilterOperator })
        }
      >
        {OPERATOR_OPTIONS.map((op) => (
          <option key={op.key} value={op.key}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value input */}
      {needsValue &&
        (isSelectField ? (
          <select
            className="h-7 max-w-[100px] rounded border border-border-base bg-surface-secondary px-1.5 text-xs outline-none"
            value={(rule.value as string) ?? ""}
            onChange={(e) => onUpdate({ value: e.target.value })}
          >
            <option value="">选择值</option>
            {field?.options?.map((opt) => (
              <option key={opt.id} value={opt.label}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="h-7 max-w-[100px] rounded border border-border-base bg-surface-secondary px-1.5 text-xs outline-none"
            placeholder="值"
            value={(rule.value as string) ?? ""}
            onChange={(e) => onUpdate({ value: e.target.value })}
          />
        ))}

      {/* Remove */}
      <button
        type="button"
        className="cursor-pointer rounded p-1 text-fg-muted hover:bg-fill-tertiary hover:text-red-500"
        onClick={onRemove}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

interface ColorDotProps {
  colorId: string;
  onChange: (colorId: string) => void;
}

function ColorDot({ colorId, onChange }: ColorDotProps) {
  const current = COLORS.find((c) => c.id === colorId) ?? COLORS[0];
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-border-subtle"
        style={{ backgroundColor: current.bg }}
        onClick={() => setOpen((v) => !v)}
        title="选择颜色"
      />
      {open && (
        <>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay */}
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 z-[60] mt-1 grid grid-cols-4 gap-1 rounded border border-border-base bg-surface-base p-2 shadow-lg">
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn(
                  "h-5 w-5 cursor-pointer rounded-full border",
                  colorId === c.id
                    ? "border-blue-500 ring-1 ring-blue-500"
                    : "border-border-subtle",
                )}
                style={{ backgroundColor: c.bg }}
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
                title={c.label}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
