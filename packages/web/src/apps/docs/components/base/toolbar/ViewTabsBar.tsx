import { cn } from "@tokiomo/components";
import {
  BarChart3,
  Calendar,
  Columns3,
  FileText,
  Image,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Table,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BaseView, ViewType } from "../types";
import type { BaseEditorState } from "../useBaseEditor";

const VIEW_TYPE_ICON: Record<ViewType, React.ReactNode> = {
  grid: <Table size={14} />,
  kanban: <Columns3 size={14} />,
  calendar: <Calendar size={14} />,
  gantt: <BarChart3 size={14} />,
  gallery: <Image size={14} />,
  form: <FileText size={14} />,
};

const VIEW_TYPE_LABELS: Record<ViewType, string> = {
  grid: "表格视图",
  kanban: "看板视图",
  calendar: "日历视图",
  gantt: "甘特视图",
  gallery: "画册视图",
  form: "表单视图",
};

const VIEW_TYPE_ORDER: ViewType[] = [
  "grid",
  "kanban",
  "calendar",
  "gantt",
  "gallery",
  "form",
];

interface ViewTabsBarProps {
  state: BaseEditorState;
}

export function ViewTabsBar({ state }: ViewTabsBarProps) {
  const { activeView, activeTable } = state;
  const [showNewViewMenu, setShowNewViewMenu] = useState(false);

  if (!activeTable) return null;

  const views = activeTable.views;

  return (
    <div className="flex items-center border-b border-border-subtle bg-surface-secondary px-2">
      <div className="flex items-center gap-0.5 overflow-x-auto">
        {views.map((view) => (
          <ViewTab
            key={view.id}
            view={view}
            isActive={view.id === activeView?.id}
            onSelect={() => state.setActiveView(view.id)}
            onRename={(name) => state.updateView(view.id, { name })}
            onDelete={() => state.deleteView(view.id)}
            canDelete={views.length > 1}
          />
        ))}
      </div>

      {/* Add view button with dropdown */}
      <div className="relative">
        <button
          type="button"
          className="ml-1 flex shrink-0 cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
          onClick={() => setShowNewViewMenu((v) => !v)}
        >
          <Plus size={14} />
          <span>新建视图</span>
        </button>
        {showNewViewMenu && (
          <>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowNewViewMenu(false)}
            />
            <div className="absolute top-full left-0 z-50 mt-1 min-w-[150px] rounded border border-border-base bg-surface-base py-1 shadow-lg">
              {VIEW_TYPE_ORDER.map((vt) => (
                <button
                  key={vt}
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
                  onClick={() => {
                    state.addViewWithType(vt);
                    setShowNewViewMenu(false);
                  }}
                >
                  {VIEW_TYPE_ICON[vt]}
                  {VIEW_TYPE_LABELS[vt]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Single view tab ─────────────────────────────────────────────────────────

interface ViewTabProps {
  view: BaseView;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}

function ViewTab({
  view,
  isActive,
  onSelect,
  onRename,
  onDelete,
  canDelete,
}: ViewTabProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(view.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const tabRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const commitRename = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== view.name) {
      onRename(trimmed);
    }
    setRenaming(false);
  }, [draft, view.name, onRename]);

  const startRename = useCallback(() => {
    setDraft(view.name);
    setRenaming(true);
    setMenuOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [view.name]);

  const openMenu = useCallback(() => {
    if (tabRef.current) {
      const rect = tabRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.left });
    }
    setMenuOpen(true);
  }, []);

  useEffect(() => {
    setDraft(view.name);
  }, [view.name]);

  const viewIcon = VIEW_TYPE_ICON[view.type] ?? <LayoutGrid size={14} />;

  return (
    <div ref={tabRef} className="group relative flex items-center">
      <button
        type="button"
        className={cn(
          "flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-xs transition-colors",
          isActive
            ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
            : "border-transparent text-fg-muted hover:text-fg-secondary",
        )}
        onClick={onSelect}
        onContextMenu={(e) => {
          e.preventDefault();
          openMenu();
        }}
      >
        {viewIcon}
        {renaming ? (
          <input
            ref={inputRef}
            className="w-16 border-none bg-transparent text-xs outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span>{view.name}</span>
        )}
      </button>

      {/* More button — visible when active or on hover */}
      {!renaming && (
        <button
          type="button"
          className={cn(
            "cursor-pointer rounded p-0.5 text-fg-muted hover:bg-fill-tertiary",
            isActive || menuOpen ? "block" : "hidden",
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (menuOpen) {
              setMenuOpen(false);
            } else {
              openMenu();
            }
          }}
        >
          <MoreHorizontal size={12} />
        </button>
      )}

      {/* Dropdown menu — rendered via portal to escape overflow clipping */}
      {menuOpen &&
        createPortal(
          <>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay */}
            <div
              className="fixed inset-0 z-[9999]"
              onClick={() => setMenuOpen(false)}
            />
            <div
              className="fixed z-[10000] min-w-[120px] rounded border border-border-base bg-surface-base py-1 shadow-lg"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <button
                type="button"
                className="flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
                onClick={startRename}
              >
                重命名
              </button>
              {canDelete && (
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-xs text-red-600 hover:bg-fill-tertiary"
                  onClick={() => {
                    onDelete();
                    setMenuOpen(false);
                  }}
                >
                  删除视图
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
