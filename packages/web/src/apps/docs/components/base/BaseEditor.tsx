import { Loader2 } from "lucide-react";
import { CalendarToolbar } from "./calendar/CalendarToolbar";
import { CalendarView } from "./calendar/CalendarView";
import { FormToolbar } from "./form/FormToolbar";
import { FormView } from "./form/FormView";
import { GalleryToolbar } from "./gallery/GalleryToolbar";
import { GalleryView } from "./gallery/GalleryView";
import { GanttToolbar } from "./gantt/GanttToolbar";
import { GanttView } from "./gantt/GanttView";
import { GridView } from "./grid/GridView";
import { KanbanToolbar } from "./kanban/KanbanToolbar";
import { KanbanView } from "./kanban/KanbanView";
import { BaseToolbar } from "./toolbar/BaseToolbar";
import { ViewTabsBar } from "./toolbar/ViewTabsBar";
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

  const viewType = state.activeView?.type;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-base">
      <ViewTabsBar state={state} />
      {viewType === "kanban" ? (
        <KanbanToolbar state={state} />
      ) : viewType === "calendar" ? (
        <CalendarToolbar state={state} />
      ) : viewType === "gantt" ? (
        <GanttToolbar state={state} />
      ) : viewType === "gallery" ? (
        <GalleryToolbar state={state} />
      ) : viewType === "form" ? (
        <FormToolbar state={state} />
      ) : (
        <BaseToolbar state={state} />
      )}
      <div className="flex-1 overflow-hidden">
        {viewType === "kanban" ? (
          <KanbanView state={state} />
        ) : viewType === "calendar" ? (
          <CalendarView state={state} />
        ) : viewType === "gantt" ? (
          <GanttView state={state} />
        ) : viewType === "gallery" ? (
          <GalleryView state={state} />
        ) : viewType === "form" ? (
          <FormView state={state} />
        ) : (
          <GridView state={state} />
        )}
      </div>
    </div>
  );
}
