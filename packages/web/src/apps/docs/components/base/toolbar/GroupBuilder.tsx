import { Plus, Trash2, X } from "lucide-react";
import { useCallback } from "react";
import type { Field, GroupRule } from "../types";
import { generateId } from "../utils";

interface GroupBuilderProps {
  groups: GroupRule[];
  fields: Field[];
  onChange: (groups: GroupRule[]) => void;
  onClose: () => void;
}

export function GroupBuilder({
  groups,
  fields,
  onChange,
  onClose,
}: GroupBuilderProps) {
  const addGroup = useCallback(() => {
    if (fields.length === 0) return;
    onChange([
      ...groups,
      { id: generateId("gr"), fieldId: fields[0].id, direction: "asc" },
    ]);
  }, [groups, fields, onChange]);

  const removeGroup = useCallback(
    (id: string) => onChange(groups.filter((g) => g.id !== id)),
    [groups, onChange],
  );

  const updateGroup = useCallback(
    (id: string, partial: Partial<GroupRule>) => {
      onChange(groups.map((g) => (g.id === id ? { ...g, ...partial } : g)));
    },
    [groups, onChange],
  );

  return (
    <>
      <div className="w-72 rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[rgba(38,38,58,0.88)] backdrop-blur-xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-fg-secondary">分组</span>
          <button
            type="button"
            className="cursor-pointer text-fg-muted hover:text-fg-primary"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-1.5">
          {groups.map((group) => (
            <div key={group.id} className="flex items-center gap-1">
              <select
                className="min-w-0 flex-1 rounded border border-black/[0.06] dark:border-white/[0.08] bg-fill-tertiary dark:bg-white/[0.08] px-1.5 py-1 text-xs text-fg-primary outline-none"
                value={group.fieldId}
                onChange={(e) =>
                  updateGroup(group.id, { fieldId: e.target.value })
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
                value={group.direction}
                onChange={(e) =>
                  updateGroup(group.id, {
                    direction: e.target.value as "asc" | "desc",
                  })
                }
              >
                <option value="asc">升序</option>
                <option value="desc">降序</option>
              </select>
              <button
                type="button"
                className="cursor-pointer text-fg-muted hover:text-red-500"
                onClick={() => removeGroup(group.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 cursor-pointer"
          onClick={addGroup}
        >
          <Plus size={12} />
          添加分组
        </button>
      </div>
    </>
  );
}
