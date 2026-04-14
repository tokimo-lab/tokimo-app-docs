import { cn } from "@tokiomo/components";
import {
  AlignJustify,
  ArrowUpDown,
  ChevronDown,
  Filter,
  Group,
  Paintbrush,
  Plus,
  Redo2,
  Settings2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { FieldConfigPanel } from "../FieldConfigPanel";
import type { RowHeight } from "../types";
import type { BaseEditorState } from "../useBaseEditor";
import { ColorBuilder } from "./ColorBuilder";
import { FilterBuilder } from "./FilterBuilder";
import { GroupBuilder } from "./GroupBuilder";
import { SortBuilder } from "./SortBuilder";

const ROW_HEIGHT_OPTIONS: { key: RowHeight; label: string }[] = [
  { key: "short", label: "紧凑" },
  { key: "medium", label: "中等" },
  { key: "tall", label: "较高" },
  { key: "extraTall", label: "超高" },
];

interface BaseToolbarProps {
  state: BaseEditorState;
}

export function BaseToolbar({ state }: BaseToolbarProps) {
  const { activeView, activeTable } = state;
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [showRowHeight, setShowRowHeight] = useState(false);
  const [showColor, setShowColor] = useState(false);

  if (!activeView || !activeTable) return null;

  const filterCount = activeView.filters.conditions.length;
  const sortCount = activeView.sorts.length;
  const groupCount = activeView.groups.length;
  const currentRowHeight = activeView.rowHeight ?? "medium";

  return (
    <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-1">
      {/* Left group */}
      <div className="flex items-center gap-1">
        {/* Add record — primary action with chevron */}
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

        {/* Field config */}
        <div className="relative">
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
            onClick={() => setShowFieldConfig((v) => !v)}
          >
            <Settings2 size={14} />
            字段配置
          </button>
          <FieldConfigPanel
            open={showFieldConfig}
            onClose={() => setShowFieldConfig(false)}
            onAddField={state.addField}
          />
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

        {/* Group */}
        <div className="relative">
          <button
            type="button"
            className={cn(
              "flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
              groupCount > 0
                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
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

        {/* Row height */}
        <div className="relative">
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
            onClick={() => setShowRowHeight((v) => !v)}
          >
            <AlignJustify size={14} />
            行高
          </button>
          {showRowHeight && (
            <>
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowRowHeight(false)}
              />
              <div className="absolute top-full left-0 z-50 mt-1 min-w-[100px] rounded border border-border-base bg-surface-base py-1 shadow-lg">
                {ROW_HEIGHT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={cn(
                      "flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary",
                      currentRowHeight === opt.key &&
                        "text-blue-600 dark:text-blue-400",
                    )}
                    onClick={() => {
                      state.setRowHeight(opt.key);
                      setShowRowHeight(false);
                    }}
                  >
                    {opt.label}
                    {currentRowHeight === opt.key && (
                      <span className="ml-auto text-blue-600 dark:text-blue-400">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Fill color */}
        <div className="relative">
          <button
            type="button"
            className={cn(
              "flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary",
              (activeView.colorRules?.length ?? 0) > 0 &&
                "text-blue-600 dark:text-blue-400",
            )}
            onClick={() => setShowColor((v) => !v)}
          >
            <Paintbrush size={14} />
            填色
          </button>
          {showColor && (
            <div className="absolute top-full left-0 z-50 mt-1">
              <ColorBuilder
                rules={activeView.colorRules ?? []}
                fields={activeTable.fields}
                onChange={state.setColorRules}
                onClose={() => setShowColor(false)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1" />

      {/* Right group: undo / redo */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className="cursor-pointer rounded p-1.5 text-fg-muted hover:bg-fill-tertiary"
          title="撤销"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          className="cursor-pointer rounded p-1.5 text-fg-muted hover:bg-fill-tertiary"
          title="重做"
        >
          <Redo2 size={14} />
        </button>
      </div>
    </div>
  );
}
