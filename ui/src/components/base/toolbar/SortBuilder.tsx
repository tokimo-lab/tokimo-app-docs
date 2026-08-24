import { Plus, Trash2, X } from "lucide-react";
import { useCallback } from "react";
import type { Field, SortRule } from "../types";
import { generateId } from "../utils";

interface SortBuilderProps {
  sorts: SortRule[];
  fields: Field[];
  onChange: (sorts: SortRule[]) => void;
  onClose: () => void;
}

export function SortBuilder({
  sorts,
  fields,
  onChange,
  onClose,
}: SortBuilderProps) {
  const addSort = useCallback(() => {
    if (fields.length === 0) return;
    onChange([
      ...sorts,
      { id: generateId("sr"), fieldId: fields[0].id, direction: "asc" },
    ]);
  }, [sorts, fields, onChange]);

  const removeSort = useCallback(
    (id: string) => onChange(sorts.filter((s) => s.id !== id)),
    [sorts, onChange],
  );

  const updateSort = useCallback(
    (id: string, partial: Partial<SortRule>) => {
      onChange(sorts.map((s) => (s.id === id ? { ...s, ...partial } : s)));
    },
    [sorts, onChange],
  );

  return (
    <div className="w-72 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-fg-secondary">排序</span>
        <button
          type="button"
          aria-label="关闭排序"
          className="cursor-pointer text-fg-muted hover:text-fg-primary"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-1.5">
        {sorts.map((sort) => (
          <div key={sort.id} className="flex items-center gap-1">
            <select
              className="min-w-0 flex-1 rounded border border-black/[0.06] dark:border-white/[0.08] bg-fill-tertiary dark:bg-white/[0.08] px-1.5 py-1 text-xs text-fg-primary outline-none"
              value={sort.fieldId}
              onChange={(e) => updateSort(sort.id, { fieldId: e.target.value })}
            >
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select
              className="rounded border border-black/[0.06] dark:border-white/[0.08] bg-fill-tertiary dark:bg-white/[0.08] px-1.5 py-1 text-xs text-fg-primary outline-none"
              value={sort.direction}
              onChange={(e) =>
                updateSort(sort.id, {
                  direction: e.target.value as "asc" | "desc",
                })
              }
            >
              <option value="asc">升序</option>
              <option value="desc">降序</option>
            </select>
            <button
              type="button"
              aria-label="删除排序条件"
              className="cursor-pointer text-fg-muted hover:text-red-500"
              onClick={() => removeSort(sort.id)}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="mt-2 flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] cursor-pointer"
        onClick={addSort}
      >
        <Plus size={12} />
        添加排序
      </button>
    </div>
  );
}
