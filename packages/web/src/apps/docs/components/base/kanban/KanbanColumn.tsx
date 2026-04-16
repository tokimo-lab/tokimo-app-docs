import type { DropdownMenuItem } from "@tokiomo/components";
import { cn, Dropdown } from "@tokiomo/components";
import { MoreHorizontal, Plus } from "lucide-react";
import { useCallback } from "react";
import type { BaseEditorState } from "../useBaseEditor";
import type { KanbanGroup } from "../utils";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  group: KanbanGroup;
  state: BaseEditorState;
  isDragOver?: boolean;
  draggingRecordId?: string | null;
  onPointerDragStart?: (
    recordId: string,
    sourceGroupId: string,
    title: string,
    cardRect: DOMRect,
    startX: number,
    startY: number,
  ) => void;
}

export function KanbanColumn({
  group,
  state,
  isDragOver,
  draggingRecordId,
  onPointerDragStart,
}: KanbanColumnProps) {
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
    <div
      data-group-id={group.id}
      className={cn(
        "flex h-full w-[280px] shrink-0 flex-col rounded-lg bg-fill-quaternary dark:bg-surface-secondary transition-colors",
        isDragOver &&
          "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)] dark:bg-[var(--accent-subtle)]",
      )}
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
          <Dropdown
            trigger={["click"]}
            placement="bottomRight"
            menu={{
              items: [
                {
                  key: "rename",
                  label: "重命名",
                  onClick: () => {
                    const newName = prompt("重命名分组", group.label);
                    if (newName?.trim())
                      state.renameKanbanGroup(group.id, newName.trim());
                  },
                },
                {
                  key: "delete",
                  label: "删除分组",
                  danger: true,
                  onClick: () => state.deleteKanbanGroup(group.id),
                },
              ] satisfies DropdownMenuItem[],
            }}
          >
            <button
              type="button"
              className="cursor-pointer rounded p-1 hover:bg-fill-tertiary"
            >
              <MoreHorizontal size={14} className="text-fg-muted" />
            </button>
          </Dropdown>
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
            isDragging={draggingRecordId === record.id}
            onPointerDragStart={onPointerDragStart}
          />
        ))}
      </div>

      {/* Add record button */}
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 px-3 py-2 text-xs text-fg-muted hover:text-[var(--accent)]"
        onClick={handleAddRecord}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
