import { useCallback, useMemo, useRef, useState } from "react";
import type { CellValue } from "../types";
import type { BaseEditorState } from "../useBaseEditor";
import { KANBAN_CAN_ADD_GROUP_TYPES, KANBAN_GROUPABLE_TYPES } from "../utils";
import { KanbanColumn } from "./KanbanColumn";
import { NewGroupInput } from "./NewGroupInput";

interface KanbanViewProps {
  state: BaseEditorState;
}

/** Resolves the field value to write when dropping into a target group. */
function resolveGroupValue(groupId: string): CellValue {
  if (groupId === "__uncategorized") return null;
  if (groupId === "__true") return true;
  if (groupId === "__false") return false;
  return groupId;
}

export function KanbanView({ state }: KanbanViewProps) {
  const { activeView, fields, kanbanGroups } = state;

  const groupField = useMemo(
    () => fields.find((f) => f.id === activeView?.kanbanConfig?.groupFieldId),
    [fields, activeView],
  );

  const hasGroupableFields = useMemo(
    () => fields.some((f) => KANBAN_GROUPABLE_TYPES.includes(f.type)),
    [fields],
  );

  const canAddGroup = groupField
    ? KANBAN_CAN_ADD_GROUP_TYPES.includes(groupField.type)
    : false;

  // ── Drag-and-drop state ──────────────────────────────────────────────
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const dragRecordIdRef = useRef<string | null>(null);
  const dragSourceGroupRef = useRef<string | null>(null);

  const handleDragStart = useCallback(
    (recordId: string, sourceGroupId: string) => {
      dragRecordIdRef.current = recordId;
      dragSourceGroupRef.current = sourceGroupId;
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, groupId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverGroupId(groupId);
    },
    [],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>, groupId: string) => {
      // Only clear if actually leaving the column (not entering a child)
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setDragOverGroupId((prev) => (prev === groupId ? null : prev));
      }
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, targetGroupId: string) => {
      e.preventDefault();
      setDragOverGroupId(null);
      const recordId = dragRecordIdRef.current;
      const sourceGroupId = dragSourceGroupRef.current;
      if (!recordId || !groupField || sourceGroupId === targetGroupId) return;

      const newValue = resolveGroupValue(targetGroupId);
      state.updateCell(recordId, groupField.id, newValue);
    },
    [groupField, state],
  );

  const handleDragEnd = useCallback(() => {
    dragRecordIdRef.current = null;
    dragSourceGroupRef.current = null;
    setDragOverGroupId(null);
  }, []);

  if (!hasGroupableFields) {
    return (
      <div className="flex h-full items-center justify-center text-fg-muted">
        <p className="text-sm">
          请先添加一个单选、多选、人员、复选框或评分字段作为分组依据
        </p>
      </div>
    );
  }

  if (!groupField) {
    return (
      <div className="flex h-full items-center justify-center text-fg-muted">
        <p className="text-sm">请选择分组依据字段</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {kanbanGroups.map((group) => (
        <KanbanColumn
          key={group.id}
          group={group}
          state={state}
          isDragOver={dragOverGroupId === group.id}
          onCardDragStart={handleDragStart}
          onColumnDragOver={handleDragOver}
          onColumnDragLeave={handleDragLeave}
          onColumnDrop={handleDrop}
          onCardDragEnd={handleDragEnd}
        />
      ))}
      {canAddGroup && (
        <NewGroupInput
          onAdd={(label, color) => state.addKanbanGroup(label, color)}
        />
      )}
    </div>
  );
}
