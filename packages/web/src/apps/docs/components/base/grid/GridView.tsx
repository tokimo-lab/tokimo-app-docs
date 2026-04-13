import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import type { BaseEditorState } from "../useBaseEditor";
import type { RecordGroup } from "../utils";
import { GridHeader } from "./GridHeader";
import { GridRow } from "./GridRow";

interface GridViewProps {
  state: BaseEditorState;
}

const ROW_NUMBER_WIDTH = 48;

export function GridView({ state }: GridViewProps) {
  const { visibleFields, groupedRecords, activeTable } = state;

  if (!activeTable) return null;

  const hasGroups =
    groupedRecords.length > 1 || groupedRecords[0]?.label !== "";

  return (
    <div className="flex h-full flex-col overflow-auto">
      <GridHeader
        fields={visibleFields}
        onResizeField={state.resizeField}
        onDeleteField={state.deleteField}
        onUpdateField={state.updateField}
        rowNumberWidth={ROW_NUMBER_WIDTH}
      />

      <div className="flex-1 overflow-auto">
        {hasGroups
          ? groupedRecords.map((group) => (
              <GroupSection key={group.key} group={group} state={state} />
            ))
          : (groupedRecords[0]?.records ?? []).map((rec, idx) => (
              <GridRow
                key={rec.id}
                record={rec}
                fields={visibleFields}
                rowIndex={idx}
                state={state}
                rowNumberWidth={ROW_NUMBER_WIDTH}
              />
            ))}

        {/* Add row button */}
        <button
          type="button"
          className="flex w-full items-center gap-1 border-b border-border-subtle px-3 py-1.5 text-xs text-fg-muted hover:bg-fill-tertiary cursor-pointer"
          onClick={state.addRecord}
        >
          <Plus size={14} />
          新增记录
        </button>
      </div>
    </div>
  );
}

// ── Group section ───────────────────────────────────────────────────────────

function GroupSection({
  group,
  state,
}: {
  group: RecordGroup;
  state: BaseEditorState;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 bg-surface-secondary px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-fill-tertiary cursor-pointer"
        onClick={() => setCollapsed((v) => !v)}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <span>{group.label}</span>
        <span className="text-fg-muted">({group.records.length})</span>
      </button>
      {!collapsed &&
        group.records.map((rec, idx) => (
          <GridRow
            key={rec.id}
            record={rec}
            fields={state.visibleFields}
            rowIndex={idx}
            state={state}
            rowNumberWidth={ROW_NUMBER_WIDTH}
          />
        ))}
    </div>
  );
}
