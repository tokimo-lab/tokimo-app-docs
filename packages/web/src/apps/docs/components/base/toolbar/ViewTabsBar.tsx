import type { DropdownMenuItem } from "@tokiomo/components";
import { cn, Dropdown } from "@tokiomo/components";
import {
  BarChart3,
  Calendar,
  Columns3,
  FileText,
  Image,
  LayoutGrid,
  MoreVertical,
  Plus,
  Table,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

  if (!activeTable) return null;

  const views = activeTable.views;

  const newViewItems: DropdownMenuItem[] = VIEW_TYPE_ORDER.map((vt) => ({
    key: vt,
    label: VIEW_TYPE_LABELS[vt],
    icon: VIEW_TYPE_ICON[vt],
    onClick: () => state.addViewWithType(vt),
  }));

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

      {/* Add view dropdown */}
      <Dropdown
        trigger={["click"]}
        placement="bottomLeft"
        menu={{ items: newViewItems }}
      >
        <button
          type="button"
          className="ml-1 flex shrink-0 cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
        >
          <Plus size={14} />
          <span>新建视图</span>
        </button>
      </Dropdown>
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

  const commitRename = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== view.name) {
      onRename(trimmed);
    }
    setRenaming(false);
  }, [draft, view.name, onRename]);

  useEffect(() => {
    setDraft(view.name);
  }, [view.name]);

  const viewIcon = VIEW_TYPE_ICON[view.type] ?? <LayoutGrid size={14} />;

  const tabMenuItems: DropdownMenuItem[] = [
    {
      key: "rename",
      label: "重命名",
      onClick: () => {
        setDraft(view.name);
        setRenaming(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      },
    },
    ...(canDelete
      ? [
          {
            key: "delete",
            label: "删除视图",
            danger: true,
            onClick: onDelete,
          } satisfies DropdownMenuItem,
        ]
      : []),
  ];

  return (
    <Dropdown
      open={menuOpen}
      onOpenChange={setMenuOpen}
      trigger={[]}
      placement="bottomLeft"
      menu={{ items: tabMenuItems }}
    >
      <div className="group relative flex items-center">
        <button
          type="button"
          className={cn(
            "flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-xs transition-colors",
            isActive
              ? "border-[var(--accent)] text-[var(--accent)] dark:border-[var(--accent)] dark:text-[var(--accent)]"
              : "border-transparent text-fg-muted hover:text-fg-secondary",
          )}
          onClick={onSelect}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpen(true);
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
          {/* More button — inside the tab so it stays within the underline */}
          {!renaming && (isActive || menuOpen) && (
            <button
              type="button"
              className="ml-0.5 inline-flex cursor-pointer rounded p-0.5 text-fg-muted hover:bg-fill-tertiary"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              <MoreVertical size={12} />
            </button>
          )}
        </button>
      </div>
    </Dropdown>
  );
}
