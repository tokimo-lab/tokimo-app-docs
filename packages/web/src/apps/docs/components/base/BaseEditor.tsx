import { Loader2 } from "lucide-react";
import { GridView } from "./grid/GridView";
import { BaseToolbar } from "./toolbar/BaseToolbar";
import { useBaseEditor } from "./useBaseEditor";

interface BaseEditorProps {
  nodeId: string;
}

export function BaseEditor({ nodeId }: BaseEditorProps) {
  const state = useBaseEditor({ nodeId });

  if (state.isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-base">
        <Loader2 size={24} className="animate-spin text-fg-muted" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-base">
      {/* Toolbar: filter / sort / group / add field / view switcher */}
      <BaseToolbar state={state} />

      {/* Grid view */}
      <div className="flex-1 overflow-hidden">
        <GridView state={state} />
      </div>
    </div>
  );
}
