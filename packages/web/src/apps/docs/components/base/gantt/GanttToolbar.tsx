import { cn, Dropdown } from "@tokimo/ui";
import { ArrowUpDown, Filter, GanttChart, Group, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { FieldConfigPanel } from "../field-config";
import { FilterBuilder } from "../toolbar/FilterBuilder";
import { GroupBuilder } from "../toolbar/GroupBuilder";
import { SortBuilder } from "../toolbar/SortBuilder";
import type { BaseEditorState } from "../useBaseEditor";
import { GanttConfigPanel } from "./GanttConfigPanel";

type PanelType = "filter" | "sort" | "group" | "config" | "fieldConfig" | null;

interface GanttToolbarProps {
  state: BaseEditorState;
}

export function GanttToolbar({ state }: GanttToolbarProps) {
  const { activeView, activeTable } = state;
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
  const groupCount = activeView.groups.length;

  return (
    <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-subtle)] dark:text-[var(--accent)] dark:hover:bg-[var(--accent-subtle)]"
          onClick={state.addRecord}
        >
          <Plus size={14} />
          添加记录
        </button>

        <div className="mx-1 h-4 w-px bg-border-subtle" />

        {/* Field config */}
        <FieldConfigPanel
          open={activePanel === "fieldConfig"}
          onOpenChange={openPanel("fieldConfig")}
          fields={state.fields}
          onAddField={state.addField}
          onUpdateField={state.updateField}
          onDeleteField={state.deleteField}
          hiddenFieldIds={activeView.hiddenFieldIds}
          onToggleFieldVisibility={(fieldId) => {
            const hidden = activeView.hiddenFieldIds;
            state.updateView(activeView.id, {
              hiddenFieldIds: hidden.includes(fieldId)
                ? hidden.filter((id) => id !== fieldId)
                : [...hidden, fieldId],
            });
          }}
        />

        {/* Gantt config */}
        <Dropdown
          trigger={["click"]}
          open={activePanel === "config"}
          onOpenChange={openPanel("config")}
          placement="bottomLeft"
          dropdownRender={() => (
            <GanttConfigPanel state={state} onClose={closePanel} />
          )}
        >
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
          >
            <GanttChart size={14} />
            甘特图配置
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
                ? "bg-[var(--accent-subtle)] text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent)]"
                : "text-fg-muted hover:bg-fill-tertiary",
            )}
          >
            <Filter size={14} />
            筛选
            {filterCount > 0 && (
              <span className="rounded-full bg-[var(--accent)] px-1.5 text-[10px] text-white">
                {filterCount}
              </span>
            )}
          </button>
        </Dropdown>

        {/* Group */}
        <Dropdown
          trigger={["click"]}
          open={activePanel === "group"}
          onOpenChange={openPanel("group")}
          placement="bottomLeft"
          dropdownRender={() => (
            <GroupBuilder
              groups={activeView.groups}
              fields={activeTable.fields}
              onChange={state.setGroups}
              onClose={closePanel}
            />
          )}
        >
          <button
            type="button"
            className={cn(
              "flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
              groupCount > 0
                ? "bg-[var(--accent-subtle)] text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent)]"
                : "text-fg-muted hover:bg-fill-tertiary",
            )}
          >
            <Group size={14} />
            分组
            {groupCount > 0 && (
              <span className="rounded-full bg-[var(--accent)] px-1.5 text-[10px] text-white">
                {groupCount}
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
                ? "bg-[var(--accent-subtle)] text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent)]"
                : "text-fg-muted hover:bg-fill-tertiary",
            )}
          >
            <ArrowUpDown size={14} />
            排序
            {sortCount > 0 && (
              <span className="rounded-full bg-[var(--accent)] px-1.5 text-[10px] text-white">
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
