import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
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
  spaceId: string;
  relPath: string;
}

export function BaseEditor({ spaceId, relPath }: BaseEditorProps) {
  const state = useBaseEditor({ spaceId, relPath });

  if (state.isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-base">
        <Loader2 size={24} className="animate-spin text-fg-muted" />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-surface-base px-6 text-center">
        <AlertCircle size={28} className="text-state-danger-text" />
        <div>
          <p className="font-medium text-fg-primary">多维表格加载失败</p>
          <p className="mt-1 max-w-md text-sm text-fg-muted">
            {state.error instanceof Error
              ? state.error.message
              : "请检查服务状态后重试"}
          </p>
        </div>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm text-fg-on-accent hover:bg-accent-hover"
          onClick={state.retry}
        >
          <RefreshCw size={14} />
          重试
        </button>
      </div>
    );
  }

  const viewType = state.activeView?.type;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white/60 dark:bg-[rgba(20,20,35,0.70)] backdrop-blur-2xl">
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
