import { useMemo } from "react";
import type { BaseEditorState } from "../useBaseEditor";
import { KANBAN_CAN_ADD_GROUP_TYPES, KANBAN_GROUPABLE_TYPES } from "../utils";
import { KanbanColumn } from "./KanbanColumn";
import { NewGroupInput } from "./NewGroupInput";

interface KanbanViewProps {
  state: BaseEditorState;
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
        <KanbanColumn key={group.id} group={group} state={state} />
      ))}
      {canAddGroup && (
        <NewGroupInput
          onAdd={(label, color) => state.addKanbanGroup(label, color)}
        />
      )}
    </div>
  );
}
