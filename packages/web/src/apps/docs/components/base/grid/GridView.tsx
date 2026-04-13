import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { BaseEditorState } from "../useBaseEditor";
import type { RecordGroup } from "../utils";
import { ADD_COL_WIDTH, CHECKBOX_COL_WIDTH, GridHeader } from "./GridHeader";
import { GridRow } from "./GridRow";

interface GridViewProps {
  state: BaseEditorState;
}

const ROW_NUMBER_WIDTH = 48;

export function GridView({ state }: GridViewProps) {
  const { visibleFields, groupedRecords, activeTable, records } = state;

  // Total minimum content width so rows always align with header
  const contentMinWidth = useMemo(() => {
    const fieldsW = visibleFields.reduce((s, f) => s + f.width, 0);
    return CHECKBOX_COL_WIDTH + ROW_NUMBER_WIDTH + fieldsW + ADD_COL_WIDTH;
  }, [visibleFields]);

  if (!activeTable) return null;

  const hasGroups =
    groupedRecords.length > 1 || groupedRecords[0]?.label !== "";

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div style={{ minWidth: contentMinWidth }}>
        <GridHeader
          fields={visibleFields}
          onResizeField={state.resizeField}
          onDeleteField={state.deleteField}
          onUpdateField={state.updateField}
          onAddField={state.addField}
          rowNumberWidth={ROW_NUMBER_WIDTH}
        />

        <div className="flex-1">
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

          {/* Add row — Feishu style: just "+" at the left margin */}
          <button
            type="button"
            className="flex h-8 w-full cursor-pointer items-center border-b border-border-subtle text-fg-muted hover:bg-fill-tertiary"
            onClick={state.addRecord}
          >
            <div
              className="flex shrink-0 items-center justify-center"
              style={{ width: CHECKBOX_COL_WIDTH + ROW_NUMBER_WIDTH }}
            >
              <Plus size={14} />
            </div>
          </button>
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="sticky bottom-0 flex items-center justify-center border-t border-border-subtle bg-surface-secondary px-3 py-1.5 text-xs text-fg-muted">
        {records.length} 条记录
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
        className="flex w-full cursor-pointer items-center gap-1.5 bg-surface-secondary px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-fill-tertiary"
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
