import { GridView } from "./grid/GridView";
import { TableTabs } from "./TableTabs";
import { BaseToolbar } from "./toolbar/BaseToolbar";
import type { BaseContent } from "./types";
import { useBaseEditor } from "./useBaseEditor";

interface BaseEditorProps {
  content: unknown;
  onChange: (content: BaseContent) => void;
}

export function BaseEditor({ content, onChange }: BaseEditorProps) {
  const state = useBaseEditor({ content, onChange });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-base">
      {/* Multi-table tabs */}
      {state.base.tables.length > 0 && (
        <TableTabs
          tables={state.base.tables}
          activeTableId={state.base.activeTableId}
          onSetActive={state.setActiveTable}
          onAdd={state.addTable}
          onDelete={state.deleteTable}
          onRename={state.renameTable}
        />
      )}

      {/* Toolbar: filter / sort / group / add field / view switcher */}
      <BaseToolbar state={state} />

      {/* Grid view */}
      <div className="flex-1 overflow-hidden">
        <GridView state={state} />
      </div>
    </div>
  );
}
