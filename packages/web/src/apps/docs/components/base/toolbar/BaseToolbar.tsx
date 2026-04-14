import { cn } from "@tokiomo/components";
import {
  AlignJustify,
  ArrowUpDown,
  Filter,
  Group,
  Paintbrush,
  Plus,
  Redo2,
  Settings2,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const toolbarRef = useRef<HTMLDivElement>(null);

  const togglePanel = useCallback((panel: PanelType) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const closePanel = useCallback(() => setActivePanel(null), []);

  // Close popup when clicking outside the toolbar
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
  const groupCount = activeView.groups.length;
  const currentRowHeight = activeView.rowHeight ?? "medium";

  return (
    <div
      ref={toolbarRef}
      className="flex items-center gap-1 border-b border-border-subtle px-3 py-1"
    >
      {/* Left group */}
      <div className="flex items-center gap-1">
        {/* Add record */}
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
          onClick={state.addRecord}
        >
          <Plus size={14} />
          添加记录
        </button>

        <div className="mx-1 h-4 w-px bg-border-subtle" />

        {/* Field config */}
        <div className="relative">
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
            onClick={() => togglePanel("fieldConfig")}
          >
            <Settings2 size={14} />
            字段配置
          </button>
          <FieldConfigPanel
            open={activePanel === "fieldConfig"}
            onClose={closePanel}
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
            onClick={() => togglePanel("group")}
          >
            <Group size={14} />
            分组
            {groupCount > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 text-[10px] text-white">
                {groupCount}
              </span>
            )}
          </button>
          {activePanel === "group" && (
            <ToolbarPopup onClose={closePanel}>
              <GroupBuilder
                groups={activeView.groups}
                fields={activeTable.fields}
                onChange={state.setGroups}
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

        {/* Row height */}
        <div className="relative">
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
            onClick={() => togglePanel("rowHeight")}
          >
            <AlignJustify size={14} />
            行高
          </button>
          {activePanel === "rowHeight" && (
            <ToolbarPopup onClose={closePanel}>
              <div className="min-w-[100px] rounded border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[rgba(38,38,58,0.88)] backdrop-blur-xl py-1 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
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
                      closePanel();
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
            </ToolbarPopup>
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
            onClick={() => togglePanel("color")}
          >
            <Paintbrush size={14} />
            填色
          </button>
          {activePanel === "color" && (
            <ToolbarPopup onClose={closePanel}>
              <ColorBuilder
                rules={activeView.colorRules ?? []}
                fields={activeTable.fields}
                onChange={state.setColorRules}
                onClose={closePanel}
              />
            </ToolbarPopup>
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

// ── Popup wrapper with backdrop + animation ─────────────────────────────────

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
