import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CellValue } from "../types";
import type { BaseEditorState } from "../useBaseEditor";
import { KANBAN_CAN_ADD_GROUP_TYPES, KANBAN_GROUPABLE_TYPES } from "../utils";
import { KanbanColumn } from "./KanbanColumn";
import { NewGroupInput } from "./NewGroupInput";

interface KanbanViewProps {
  state: BaseEditorState;
}

interface DragState {
  recordId: string;
  sourceGroupId: string;
  title: string;
  ghostWidth: number;
  currentX: number;
  currentY: number;
}

/** Resolves the field value to write when dropping into a target group. */
function resolveGroupValue(groupId: string): CellValue {
  if (groupId === "__uncategorized") return null;
  if (groupId === "__true") return true;
  if (groupId === "__false") return false;
  return groupId;
}

/** Finds the kanban column group-id under the cursor via `elementsFromPoint`. */
function findGroupIdAtPoint(x: number, y: number): string | null {
  const elements = document.elementsFromPoint(x, y);
  for (const el of elements) {
    if (el instanceof HTMLElement) {
      const groupId = el.dataset.groupId;
      if (groupId) return groupId;
      const closest = el.closest<HTMLElement>("[data-group-id]");
      if (closest) return closest.dataset.groupId ?? null;
    }
  }
  return null;
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

  // ── Pointer-based drag state ─────────────────────────────────────────
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const handlePointerDragStart = useCallback(
    (
      recordId: string,
      sourceGroupId: string,
      title: string,
      cardRect: DOMRect,
      startX: number,
      startY: number,
    ) => {
      const initial: DragState = {
        recordId,
        sourceGroupId,
        title,
        ghostWidth: cardRect.width,
        currentX: startX,
        currentY: startY,
      };
      dragStateRef.current = initial;
      setDragState(initial);
    },
    [],
  );

  // Global pointermove / pointerup listeners while dragging
  const isDragging = dragState !== null;
  const groupFieldRef = useRef(groupField);
  groupFieldRef.current = groupField;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      const next: DragState = {
        ...dragStateRef.current!,
        currentX: e.clientX,
        currentY: e.clientY,
      };
      dragStateRef.current = next;
      setDragState(next);

      const groupId = findGroupIdAtPoint(e.clientX, e.clientY);
      setDragOverGroupId(groupId);
    };

    const onPointerUp = (e: PointerEvent) => {
      const ds = dragStateRef.current;
      const gf = groupFieldRef.current;
      const targetGroupId = findGroupIdAtPoint(e.clientX, e.clientY);

      if (ds && targetGroupId && gf && targetGroupId !== ds.sourceGroupId) {
        const newValue = resolveGroupValue(targetGroupId);
        stateRef.current.updateCell(ds.recordId, gf.id, newValue);
      }

      dragStateRef.current = null;
      setDragState(null);
      setDragOverGroupId(null);
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [isDragging]);

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
    <>
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {kanbanGroups.map((group) => (
          <KanbanColumn
            key={group.id}
            group={group}
            state={state}
            isDragOver={dragOverGroupId === group.id}
            draggingRecordId={dragState?.recordId ?? null}
            onPointerDragStart={handlePointerDragStart}
          />
        ))}
        {canAddGroup && (
          <NewGroupInput
            onAdd={(label, color) => state.addKanbanGroup(label, color)}
          />
        )}
      </div>

      {/* Drag ghost portal */}
      {dragState &&
        createPortal(
          <div
            className="pointer-events-none fixed rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm font-medium shadow-lg opacity-80"
            style={{
              zIndex: 99999,
              left: dragState.currentX - dragState.ghostWidth / 2,
              top: dragState.currentY - 16,
              width: dragState.ghostWidth,
            }}
          >
            <span className="block truncate">
              {dragState.title || "未命名记录"}
            </span>
          </div>,
          document.body,
        )}
    </>
  );
}
