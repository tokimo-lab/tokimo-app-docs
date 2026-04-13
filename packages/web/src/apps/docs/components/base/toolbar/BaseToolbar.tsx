import { cn } from "@tokiomo/components";
import { ArrowUpDown, Eye, Filter, Group, Plus } from "lucide-react";
import { useState } from "react";
import { FieldConfigPanel } from "../FieldConfigPanel";
import type { BaseEditorState } from "../useBaseEditor";
import { FilterBuilder } from "./FilterBuilder";
import { GroupBuilder } from "./GroupBuilder";
import { SortBuilder } from "./SortBuilder";

interface BaseToolbarProps {
  state: BaseEditorState;
}

export function BaseToolbar({ state }: BaseToolbarProps) {
  const { activeView, activeTable } = state;
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [showAddField, setShowAddField] = useState(false);

  if (!activeView || !activeTable) return null;

  const filterCount = activeView.filters.conditions.length;
  const sortCount = activeView.sorts.length;
  const groupCount = activeView.groups.length;

  return (
    <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-1">
      {/* Filter */}
      <div className="relative">
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors cursor-pointer",
            filterCount > 0
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
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
            "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors cursor-pointer",
            sortCount > 0
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
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

      {/* Group */}
      <div className="relative">
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors cursor-pointer",
            groupCount > 0
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : "text-fg-muted hover:bg-fill-tertiary",
          )}
          onClick={() => setShowGroup((v) => !v)}
        >
          <Group size={14} />
          分组
          {groupCount > 0 && (
            <span className="rounded-full bg-blue-600 px-1.5 text-[10px] text-white">
              {groupCount}
            </span>
          )}
        </button>
        {showGroup && (
          <div className="absolute top-full left-0 z-50 mt-1">
            <GroupBuilder
              groups={activeView.groups}
              fields={activeTable.fields}
              onChange={state.setGroups}
              onClose={() => setShowGroup(false)}
            />
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Add field */}
      <div className="relative">
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary cursor-pointer"
          onClick={() => setShowAddField((v) => !v)}
        >
          <Plus size={14} />
          字段
        </button>
        <FieldConfigPanel
          open={showAddField}
          onClose={() => setShowAddField(false)}
          onAddField={state.addField}
        />
      </div>

      {/* View switcher */}
      {activeTable.views.length > 1 && (
        <div className="flex items-center gap-0.5 rounded border border-border-subtle px-1">
          {activeTable.views.map((v) => (
            <button
              key={v.id}
              type="button"
              className={cn(
                "rounded px-2 py-0.5 text-xs transition-colors cursor-pointer",
                v.id === activeView.id
                  ? "bg-fill-secondary text-fg-primary"
                  : "text-fg-muted hover:bg-fill-tertiary",
              )}
              onClick={() => state.setActiveView(v.id)}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      {/* Add view */}
      <button
        type="button"
        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary cursor-pointer"
        onClick={state.addView}
        title="新增视图"
      >
        <Eye size={14} />
        <Plus size={10} />
      </button>
    </div>
  );
}
