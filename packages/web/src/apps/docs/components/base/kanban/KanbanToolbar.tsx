import { cn } from "@tokiomo/components";
import {
  ArrowUpDown,
  ChevronDown,
  Filter,
  Plus,
  Settings2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FilterBuilder } from "../toolbar/FilterBuilder";
import { SortBuilder } from "../toolbar/SortBuilder";
import type { BaseEditorState } from "../useBaseEditor";
import { CardConfigPanel } from "./CardConfigPanel";
import { GroupBySelector } from "./GroupBySelector";

type PanelType = "filter" | "sort" | "groupBy" | "cardConfig" | null;

interface KanbanToolbarProps {
  state: BaseEditorState;
}

export function KanbanToolbar({ state }: KanbanToolbarProps) {
  const { activeView, activeTable, fields } = state;
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const togglePanel = useCallback((panel: PanelType) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);
  const closePanel = useCallback(() => setActivePanel(null), []);

  useEffect(() => {
    if (!activePanel) return;
    const handler = (e: PointerEvent) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(e.target as Node)
      ) {
        setActivePanel(null);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [activePanel]);

  if (!activeView || !activeTable) return null;

  const filterCount = activeView.filters.conditions.length;
  const sortCount = activeView.sorts.length;
  const groupField = fields.find(
    (f) => f.id === activeView.kanbanConfig?.groupFieldId,
  );

  return (
    <div
      ref={toolbarRef}
      className="flex items-center gap-1 border-b border-border-subtle px-3 py-1"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
          onClick={state.addRecord}
        >
          <Plus size={14} />
          添加记录
          <ChevronDown size={12} />
        </button>

        <div className="mx-1 h-4 w-px bg-border-subtle" />

        {/* Group by */}
        <div className="relative">
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
            onClick={() => togglePanel("groupBy")}
          >
            分组依据
            {groupField && (
              <span className="text-fg-secondary">{groupField.name}</span>
            )}
          </button>
          {activePanel === "groupBy" && (
            <ToolbarPopup onClose={closePanel}>
              <GroupBySelector
                fields={fields}
                selectedFieldId={activeView.kanbanConfig?.groupFieldId ?? ""}
                onSelect={(fieldId) => {
                  state.setKanbanGroupField(fieldId);
                  closePanel();
                }}
                onClose={closePanel}
              />
            </ToolbarPopup>
          )}
        </div>

        {/* Card config */}
        <div className="relative">
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
            onClick={() => togglePanel("cardConfig")}
          >
            <Settings2 size={14} />
            卡片配置
          </button>
          {activePanel === "cardConfig" && (
            <ToolbarPopup onClose={closePanel}>
              <CardConfigPanel state={state} onClose={closePanel} />
            </ToolbarPopup>
          )}
        </div>

        {/* Filter */}
        <div className="relative">
          <button
            type="button"
            className={cn(
              "flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
              filterCount > 0
                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                : "text-fg-muted hover:bg-fill-tertiary",
            )}
            onClick={() => togglePanel("filter")}
          >
            <Filter size={14} />
            筛选
            {filterCount > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 text-[10px] text-white">
                {filterCount}
              </span>
            )}
          </button>
          {activePanel === "filter" && (
            <ToolbarPopup onClose={closePanel}>
              <FilterBuilder
                conditions={activeView.filters.conditions}
                conjunction={activeView.filters.conjunction}
                fields={activeTable.fields}
                onChange={state.setFilters}
                onClose={closePanel}
              />
            </ToolbarPopup>
          )}
        </div>

        {/* Sort */}
        <div className="relative">
          <button
            type="button"
            className={cn(
              "flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
              sortCount > 0
                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                : "text-fg-muted hover:bg-fill-tertiary",
            )}
            onClick={() => togglePanel("sort")}
          >
            <ArrowUpDown size={14} />
            排序
            {sortCount > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 text-[10px] text-white">
                {sortCount}
              </span>
            )}
          </button>
          {activePanel === "sort" && (
            <ToolbarPopup onClose={closePanel}>
              <SortBuilder
                sorts={activeView.sorts}
                fields={activeTable.fields}
                onChange={state.setSorts}
                onClose={closePanel}
              />
            </ToolbarPopup>
          )}
        </div>
      </div>
      <div className="flex-1" />
    </div>
  );
}

function ToolbarPopup({
  children,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute top-full left-0 z-50 mt-1"
      style={{
        animation: "toolbar-popup-in 150ms ease-out",
      }}
    >
      {children}
    </div>
  );
}
