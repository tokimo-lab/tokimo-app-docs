import { cn } from "@tokiomo/components";
import {
  ArrowUpDown,
  ChevronDown,
  Filter,
  Plus,
  Settings2,
} from "lucide-react";
import { useState } from "react";
import { FilterBuilder } from "../toolbar/FilterBuilder";
import { SortBuilder } from "../toolbar/SortBuilder";
import type { BaseEditorState } from "../useBaseEditor";
import { CardConfigPanel } from "./CardConfigPanel";
import { GroupBySelector } from "./GroupBySelector";

interface KanbanToolbarProps {
  state: BaseEditorState;
}

export function KanbanToolbar({ state }: KanbanToolbarProps) {
  const { activeView, activeTable, fields } = state;
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showGroupBy, setShowGroupBy] = useState(false);
  const [showCardConfig, setShowCardConfig] = useState(false);

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
          <ChevronDown size={12} />
        </button>

        <div className="mx-1 h-4 w-px bg-border-subtle" />

        {/* Group by */}
        <div className="relative">
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
            onClick={() => setShowGroupBy((v) => !v)}
          >
            分组依据
            {groupField && (
              <span className="text-fg-secondary">{groupField.name}</span>
            )}
          </button>
          {showGroupBy && (
            <div className="absolute top-full left-0 z-50 mt-1">
              <GroupBySelector
                fields={fields}
                selectedFieldId={activeView.kanbanConfig?.groupFieldId ?? ""}
                onSelect={(fieldId) => {
                  state.setKanbanGroupField(fieldId);
                  setShowGroupBy(false);
                }}
                onClose={() => setShowGroupBy(false)}
              />
            </div>
          )}
        </div>

        {/* Card config */}
        <div className="relative">
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
            onClick={() => setShowCardConfig((v) => !v)}
          >
            <Settings2 size={14} />
            卡片配置
          </button>
          {showCardConfig && (
            <div className="absolute top-full left-0 z-50 mt-1">
              <CardConfigPanel
                state={state}
                onClose={() => setShowCardConfig(false)}
              />
            </div>
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
            onClick={() => setShowFilter((v) => !v)}
          >
            <Filter size={14} />
            筛选
            {filterCount > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 text-[10px] text-white">
                {filterCount}
              </span>
            )}
          </button>
          {showFilter && (
            <div className="absolute top-full left-0 z-50 mt-1">
              <FilterBuilder
                conditions={activeView.filters.conditions}
                conjunction={activeView.filters.conjunction}
                fields={activeTable.fields}
                onChange={state.setFilters}
                onClose={() => setShowFilter(false)}
              />
            </div>
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
            onClick={() => setShowSort((v) => !v)}
          >
            <ArrowUpDown size={14} />
            排序
            {sortCount > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 text-[10px] text-white">
                {sortCount}
              </span>
            )}
          </button>
          {showSort && (
            <div className="absolute top-full left-0 z-50 mt-1">
              <SortBuilder
                sorts={activeView.sorts}
                fields={activeTable.fields}
                onChange={state.setSorts}
                onClose={() => setShowSort(false)}
              />
            </div>
          )}
        </div>
      </div>
      <div className="flex-1" />
    </div>
  );
}
