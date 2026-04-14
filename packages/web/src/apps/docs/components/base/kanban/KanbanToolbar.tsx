import { cn, Dropdown } from "@tokiomo/components";
import { ArrowUpDown, Filter, Plus, Settings2 } from "lucide-react";
import { useCallback, useState } from "react";
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

  const openPanel = useCallback(
    (panel: PanelType) => (open: boolean) =>
      setActivePanel(open ? panel : null),
    [],
  );
  const closePanel = useCallback(() => setActivePanel(null), []);

  if (!activeView || !activeTable) return null;

  const filterCount = activeView.filters.conditions.length;
  const sortCount = activeView.sorts.length;
  const groupField = fields.find(
    (f) => f.id === activeView.kanbanConfig?.groupFieldId,
  );

  return (
    <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
          onClick={state.addRecord}
        >
          <Plus size={14} />
          添加记录
        </button>

        <div className="mx-1 h-4 w-px bg-border-subtle" />

        {/* Group by */}
        <Dropdown
          trigger={["click"]}
          open={activePanel === "groupBy"}
          onOpenChange={openPanel("groupBy")}
          placement="bottomLeft"
          dropdownRender={() => (
            <GroupBySelector
              fields={fields}
              selectedFieldId={activeView.kanbanConfig?.groupFieldId ?? ""}
              onSelect={(fieldId) => {
                state.setKanbanGroupField(fieldId);
                closePanel();
              }}
              onClose={closePanel}
            />
          )}
        >
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
          >
            分组依据
            {groupField && (
              <span className="text-fg-secondary">{groupField.name}</span>
            )}
          </button>
        </Dropdown>

        {/* Card config */}
        <Dropdown
          trigger={["click"]}
          open={activePanel === "cardConfig"}
          onOpenChange={openPanel("cardConfig")}
          placement="bottomLeft"
          dropdownRender={() => (
            <CardConfigPanel state={state} onClose={closePanel} />
          )}
        >
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
          >
            <Settings2 size={14} />
            卡片配置
          </button>
        </Dropdown>

        {/* Filter */}
        <Dropdown
          trigger={["click"]}
          open={activePanel === "filter"}
          onOpenChange={openPanel("filter")}
          placement="bottomLeft"
          dropdownRender={() => (
            <FilterBuilder
              conditions={activeView.filters.conditions}
              conjunction={activeView.filters.conjunction}
              fields={activeTable.fields}
              onChange={state.setFilters}
              onClose={closePanel}
            />
          )}
        >
          <button
            type="button"
            className={cn(
              "flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
              filterCount > 0
                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                : "text-fg-muted hover:bg-fill-tertiary",
            )}
          >
            <Filter size={14} />
            筛选
            {filterCount > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 text-[10px] text-white">
                {filterCount}
              </span>
            )}
          </button>
        </Dropdown>

        {/* Sort */}
        <Dropdown
          trigger={["click"]}
          open={activePanel === "sort"}
          onOpenChange={openPanel("sort")}
          placement="bottomLeft"
          dropdownRender={() => (
            <SortBuilder
              sorts={activeView.sorts}
              fields={activeTable.fields}
              onChange={state.setSorts}
              onClose={closePanel}
            />
          )}
        >
          <button
            type="button"
            className={cn(
              "flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
              sortCount > 0
                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                : "text-fg-muted hover:bg-fill-tertiary",
            )}
          >
            <ArrowUpDown size={14} />
            排序
            {sortCount > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 text-[10px] text-white">
                {sortCount}
              </span>
            )}
          </button>
        </Dropdown>
      </div>
      <div className="flex-1" />
    </div>
  );
}
