import type { DropdownMenuItem } from "@tokimo/ui";
import { cn, Dropdown } from "@tokimo/ui";
import { MoreHorizontal, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(group.label);
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

  const commitRename = useCallback(() => {
    const nextName = renameValue.trim();
    if (nextName && nextName !== group.label) {
      state.renameKanbanGroup(group.id, nextName);
    }
    setIsRenaming(false);
  }, [group.id, group.label, renameValue, state]);

  return (
    <div
      data-group-id={group.id}
      className={cn(
        "flex h-full w-[280px] shrink-0 flex-col rounded-lg bg-fill-tertiary transition-colors",
        isDragOver && "bg-accent-subtle ring-2 ring-accent",
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isRenaming ? (
            <input
              // biome-ignore lint/a11y/noAutofocus: rename is explicitly initiated from the group menu
              autoFocus
              aria-label={t("base.kanban.renameGroup")}
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") setIsRenaming(false);
              }}
              className="h-6 min-w-0 flex-1 rounded border border-border-base bg-surface-sunken px-2 text-xs text-fg-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          ) : group.color ? (
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
                  label: t("base.kanban.rename"),
                  onClick: () => {
                    setRenameValue(group.label);
                    setIsRenaming(true);
                  },
                },
                {
                  key: "delete",
                  label: t("base.kanban.deleteGroup"),
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
        className="flex cursor-pointer items-center gap-1 px-3 py-2 text-xs text-fg-muted hover:text-accent-text"
        onClick={handleAddRecord}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
