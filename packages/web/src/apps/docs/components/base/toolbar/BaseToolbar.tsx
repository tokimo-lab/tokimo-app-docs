import type { DropdownMenuItem } from "@tokiomo/components";
import { cn, Dropdown } from "@tokiomo/components";
import {
  AlignJustify,
  ArrowUpDown,
  Filter,
  Group,
  Paintbrush,
  Plus,
  Redo2,
  Undo2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { FieldConfigPanel } from "../field-config";
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

type PanelType =
  | "fieldConfig"
  | "filter"
  | "group"
  | "sort"
  | "rowHeight"
  | "color"
  | null;

interface BaseToolbarProps {
  state: BaseEditorState;
}

export function BaseToolbar({ state }: BaseToolbarProps) {
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
  const currentRowHeight = activeView.rowHeight ?? "medium";

  const rowHeightItems: DropdownMenuItem[] = ROW_HEIGHT_OPTIONS.map((opt) => ({
    key: opt.key,
    label: (
      <span className="flex w-full items-center text-xs">
        {opt.label}
        {currentRowHeight === opt.key && (
          <span className="ml-auto text-[var(--accent)]">✓</span>
        )}
      </span>
    ),
    onClick: () => state.setRowHeight(opt.key),
  }));

  return (
    <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-1">
      {/* Left group */}
      <div className="flex items-center gap-1">
        {/* Add record */}
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

        {/* Row height */}
        <Dropdown
          trigger={["click"]}
          open={activePanel === "rowHeight"}
          onOpenChange={openPanel("rowHeight")}
          placement="bottomLeft"
          menu={{ items: rowHeightItems }}
        >
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
          >
            <AlignJustify size={14} />
            行高
          </button>
        </Dropdown>

        {/* Fill color */}
        <Dropdown
          trigger={["click"]}
          open={activePanel === "color"}
          onOpenChange={openPanel("color")}
          placement="bottomLeft"
          dropdownRender={() => (
            <ColorBuilder
              rules={activeView.colorRules ?? []}
              fields={activeTable.fields}
              onChange={state.setColorRules}
              onClose={closePanel}
            />
          )}
        >
          <button
            type="button"
            className={cn(
              "flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary",
              (activeView.colorRules?.length ?? 0) > 0 &&
                "text-[var(--accent)]",
            )}
          >
            <Paintbrush size={14} />
            填色
          </button>
        </Dropdown>
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
