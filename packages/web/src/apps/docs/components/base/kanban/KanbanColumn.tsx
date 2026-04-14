import { cn } from "@tokiomo/components";
import { MoreHorizontal, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import type { BaseEditorState } from "../useBaseEditor";
import type { KanbanGroup } from "../utils";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  group: KanbanGroup;
  state: BaseEditorState;
  isDragOver?: boolean;
  onCardDragStart?: (recordId: string, sourceGroupId: string) => void;
  onColumnDragOver?: (
    e: React.DragEvent<HTMLDivElement>,
    groupId: string,
  ) => void;
  onColumnDragLeave?: (
    e: React.DragEvent<HTMLDivElement>,
    groupId: string,
  ) => void;
  onColumnDrop?: (e: React.DragEvent<HTMLDivElement>, groupId: string) => void;
  onCardDragEnd?: () => void;
}

export function KanbanColumn({
  group,
  state,
  isDragOver,
  onCardDragStart,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop,
  onCardDragEnd,
}: KanbanColumnProps) {
  const [showMenu, setShowMenu] = useState(false);
  const isUncategorized =
    group.id === "__uncategorized" || group.id === "__false";

  const handleAddRecord = useCallback(() => {
    const val =
      group.id === "__uncategorized" || group.id === "__false"
        ? null
        : group.id === "__true"
          ? "__true"
          : group.id;
    state.addRecordToGroup(val);
  }, [group.id, state]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target
    <div
      className={cn(
        "flex h-full w-[280px] shrink-0 flex-col rounded-lg bg-fill-quaternary dark:bg-surface-secondary transition-colors",
        isDragOver && "ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-950/30",
      )}
      onDragOver={(e) => onColumnDragOver?.(e, group.id)}
      onDragLeave={(e) => onColumnDragLeave?.(e, group.id)}
      onDrop={(e) => onColumnDrop?.(e, group.id)}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {group.color ? (
            <span
              className="inline-block shrink-0 rounded px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: group.color }}
            >
              {group.label}
            </span>
          ) : (
            <span className="text-xs font-medium text-fg-muted">
              {group.label}
            </span>
          )}
          <span className="text-xs text-fg-muted">{group.records.length}</span>
        </div>
        {!isUncategorized && (
          <div className="relative">
            <button
              type="button"
              className="cursor-pointer rounded p-1 hover:bg-fill-tertiary"
              onClick={() => setShowMenu((v) => !v)}
            >
              <MoreHorizontal size={14} className="text-fg-muted" />
            </button>
            {showMenu && (
              <>
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay */}
                {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute top-full right-0 z-50 mt-1 w-36 rounded border border-border-base bg-surface-base py-1 shadow-lg">
                  <button
                    type="button"
                    className="w-full cursor-pointer px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
                    onClick={() => {
                      const newName = prompt("重命名分组", group.label);
                      if (newName?.trim())
                        state.renameKanbanGroup(group.id, newName.trim());
                      setShowMenu(false);
                    }}
                  >
                    重命名
                  </button>
                  <button
                    type="button"
                    className="w-full cursor-pointer px-3 py-1.5 text-left text-xs text-red-600 hover:bg-fill-tertiary"
                    onClick={() => {
                      state.deleteKanbanGroup(group.id);
                      setShowMenu(false);
                    }}
                  >
                    删除分组
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        {group.records.map((record) => (
          <KanbanCard
            key={record.id}
            record={record}
            state={state}
            groupId={group.id}
            onDragStart={onCardDragStart}
            onDragEnd={onCardDragEnd}
          />
        ))}
      </div>

      {/* Add record button */}
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 px-3 py-2 text-xs text-fg-muted hover:text-blue-600"
        onClick={handleAddRecord}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
