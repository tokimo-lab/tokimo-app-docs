import { cn } from "@tokiomo/components";
import { Plus, X } from "lucide-react";
import { useCallback, useState } from "react";
import type { BaseTable } from "./types";

interface TableTabsProps {
  tables: BaseTable[];
  activeTableId: string;
  onSetActive: (tableId: string) => void;
  onAdd: () => void;
  onDelete: (tableId: string) => void;
  onRename: (tableId: string, name: string) => void;
}

export function TableTabs({
  tables,
  activeTableId,
  onSetActive,
  onAdd,
  onDelete,
  onRename,
}: TableTabsProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const startRename = useCallback((table: BaseTable) => {
    setRenamingId(table.id);
    setDraft(table.name);
  }, []);

  const commitRename = useCallback(() => {
    if (renamingId && draft.trim()) {
      onRename(renamingId, draft.trim());
    }
    setRenamingId(null);
  }, [renamingId, draft, onRename]);

  return (
    <div className="flex items-center gap-0.5 border-b border-border-subtle px-2 py-1">
      {tables.map((table) => {
        const isActive = table.id === activeTableId;
        const isRenaming = renamingId === table.id;

        return (
          <div
            key={table.id}
            className={cn(
              "group flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors",
              isActive
                ? "bg-fill-secondary font-medium text-fg-primary"
                : "text-fg-muted hover:bg-fill-tertiary cursor-pointer",
            )}
          >
            {isRenaming ? (
              <input
                className="w-20 border-none bg-transparent text-xs outline-none"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setRenamingId(null);
                }}
              />
            ) : (
              <button
                type="button"
                className="bg-transparent border-none p-0 m-0 text-inherit font-inherit cursor-pointer"
                onClick={() => onSetActive(table.id)}
                onDoubleClick={() => startRename(table)}
              >
                {table.name}
              </button>
            )}

            {tables.length > 1 && isActive && !isRenaming && (
              <button
                type="button"
                className="hidden cursor-pointer rounded p-0.5 text-fg-muted hover:text-red-500 group-hover:block"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(table.id);
                }}
              >
                <X size={10} />
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        className="rounded p-1 text-fg-muted hover:bg-fill-tertiary cursor-pointer"
        onClick={onAdd}
        title="新增数据表"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
