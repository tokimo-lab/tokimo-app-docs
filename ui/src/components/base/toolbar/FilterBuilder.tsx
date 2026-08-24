import { Plus, Trash2, X } from "lucide-react";
import { useCallback } from "react";
import type { Field, FilterCondition, FilterOperator } from "../types";
import { generateId } from "../utils";

interface FilterBuilderProps {
  conditions: FilterCondition[];
  conjunction: "and" | "or";
  fields: Field[];
  onChange: (conditions: FilterCondition[], conjunction?: "and" | "or") => void;
  onClose: () => void;
}

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "eq", label: "等于" },
  { value: "neq", label: "不等于" },
  { value: "contains", label: "包含" },
  { value: "notContains", label: "不包含" },
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "lt", label: "小于" },
  { value: "lte", label: "小于等于" },
  { value: "isEmpty", label: "为空" },
  { value: "isNotEmpty", label: "不为空" },
];

export function FilterBuilder({
  conditions,
  conjunction,
  fields,
  onChange,
  onClose,
}: FilterBuilderProps) {
  const addCondition = useCallback(() => {
    if (fields.length === 0) return;
    onChange([
      ...conditions,
      {
        id: generateId("fc"),
        fieldId: fields[0].id,
        operator: "contains",
        value: "",
      },
    ]);
  }, [conditions, fields, onChange]);

  const removeCondition = useCallback(
    (id: string) => {
      onChange(conditions.filter((c) => c.id !== id));
    },
    [conditions, onChange],
  );

  const updateCondition = useCallback(
    (id: string, partial: Partial<FilterCondition>) => {
      onChange(conditions.map((c) => (c.id === id ? { ...c, ...partial } : c)));
    },
    [conditions, onChange],
  );

  return (
    <div className="w-80 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-fg-secondary">筛选</span>
        <button
          type="button"
          aria-label="关闭筛选"
          className="cursor-pointer text-fg-muted hover:text-fg-primary"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      {conditions.length > 1 && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs text-fg-muted">满足</span>
          <select
            className="rounded border border-black/[0.06] dark:border-white/[0.08] bg-fill-tertiary dark:bg-white/[0.08] px-1.5 py-0.5 text-xs text-fg-primary outline-none"
            value={conjunction}
            onChange={(e) =>
              onChange(conditions, e.target.value as "and" | "or")
            }
          >
            <option value="and">所有条件</option>
            <option value="or">任一条件</option>
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        {conditions.map((cond) => (
          <div key={cond.id} className="flex items-center gap-1">
            <select
              className="min-w-0 flex-1 rounded border border-black/[0.06] dark:border-white/[0.08] bg-fill-tertiary dark:bg-white/[0.08] px-1.5 py-1 text-xs text-fg-primary outline-none"
              value={cond.fieldId}
              onChange={(e) =>
                updateCondition(cond.id, { fieldId: e.target.value })
              }
            >
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select
              className="rounded border border-black/[0.06] dark:border-white/[0.08] bg-fill-tertiary dark:bg-white/[0.08] px-1.5 py-1 text-xs text-fg-primary outline-none"
              value={cond.operator}
              onChange={(e) =>
                updateCondition(cond.id, {
                  operator: e.target.value as FilterOperator,
                })
              }
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
            {cond.operator !== "isEmpty" && cond.operator !== "isNotEmpty" && (
              <input
                className="w-20 rounded border border-black/[0.06] dark:border-white/[0.08] bg-fill-tertiary dark:bg-white/[0.08] px-1.5 py-1 text-xs text-fg-primary outline-none"
                value={String(cond.value ?? "")}
                onChange={(e) =>
                  updateCondition(cond.id, { value: e.target.value })
                }
              />
            )}
            <button
              type="button"
              aria-label="删除筛选条件"
              className="cursor-pointer text-fg-muted hover:text-red-500"
              onClick={() => removeCondition(cond.id)}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="mt-2 flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] cursor-pointer"
        onClick={addCondition}
      >
        <Plus size={12} />
        添加条件
      </button>
    </div>
  );
}
