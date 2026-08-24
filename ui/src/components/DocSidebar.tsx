import { cn, Dropdown, type DropdownMenuItem, Input, Spin } from "@tokimo/ui";
import {
  ArrowUpDown,
  BrainCircuit,
  ChevronsUpDown,
  Check,
  FileCode,
  FileText,
  FolderPlus,
  PanelLeft,
  PanelLeftClose,
  PenTool,
  Plus,
  Presentation,
  Search,
  Settings,
  Sheet,
  Star,
  Table2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  api,
  type DocNodeListItem,
  type DocSpaceOutput,
} from "../api/generated";
import type { DocNode, DocNodeType } from "../lib/doc-node";
import { apiNodeToLocal, parentRelPathOf } from "../lib/doc-node";
import { DocNodeTipPanel, useDocNodeTip } from "./DocNodeTip";
import { DocSidebarTagFilter } from "./DocSidebarTagFilter";
import { ArchivedNodeRow, LazyTreeNode, NodeTreeItem } from "./DocSidebarTree";

export type SidebarTab = "all" | "favorites" | "archived";
export type SortField = "updatedAt" | "createdAt" | "title" | "wordCount";
export type SortDir = "asc" | "desc";

interface DocSidebarProps {
  spaceId: string;
  spaces: DocSpaceOutput[];
  onSelectSpace: (spaceId: string) => void;
  onCreateSpace: () => void;
  onSpaceSettings: () => void;
  nodes: DocNodeListItem[];
  isLoadingNodes: boolean;
  selectedNodeId: string | null;
  onSelectNode: (node: DocNode) => void;
  tab: SidebarTab;
  onSetTab: (tab: SidebarTab) => void;
  search: string;
  onSetSearch: (search: string) => void;
  onCreateNode: (type: DocNodeType, parentRelPath?: string) => void;
  onCreateFolder: (parentRelPath?: string) => void;
  onFavoriteNode: (relPath: string) => void;
  onDeleteNode: (node: DocNode) => void;
  onUpdateNode: (relPath: string, title: string) => void;
  onRestoreNode: (nodeId: string) => void;
  onPermanentDeleteNode: (nodeId: string) => void;
  onMoveNode: (srcRelPath: string, destFolderRelPath: string | null) => void;
  sortField: SortField;
  sortDir: SortDir;
  onSetSortField: (field: SortField) => void;
  onSetSortDir: (dir: SortDir) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  filterTags: string[];
  onSetFilterTags: (tags: string[]) => void;
}

const SORT_LABEL_KEYS: Record<SortField, string> = {
  updatedAt: "sidebar.updatedAt",
  createdAt: "sidebar.createdAt",
  title: "sidebar.title",
  wordCount: "sidebar.wordCount",
};

const NAV_ITEM_KEYS: { key: SidebarTab; labelKey: string; icon: typeof FileText }[] = [
  { key: "all", labelKey: "sidebar.allDocuments", icon: FileText },
  { key: "favorites", labelKey: "sidebar.favorites", icon: Star },
  { key: "archived", labelKey: "sidebar.archived", icon: Trash2 },
];

export function DocSidebar({
  spaceId,
  spaces,
  onSelectSpace,
  onCreateSpace,
  onSpaceSettings,
  nodes,
  isLoadingNodes,
  selectedNodeId,
  onSelectNode,
  tab,
  onSetTab,
  search,
  onSetSearch,
  onCreateNode,
  onCreateFolder,
  onFavoriteNode,
  onDeleteNode,
  onUpdateNode,
  onRestoreNode,
  onPermanentDeleteNode,
  onMoveNode,
  sortField,
  sortDir,
  onSetSortField,
  onSetSortDir,
  collapsed,
  onToggleCollapsed,
  filterTags,
  onSetFilterTags,
}: DocSidebarProps) {
  const { t } = useTranslation();
  const tagsQuery = api.docs.listTags.useQuery(
    { spaceId },
    { enabled: !!spaceId },
  );
  const availableTags = tagsQuery.data ?? [];
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [renamingRelPath, setRenamingRelPath] = useState<string | null>(null);
  const tip = useDocNodeTip();

  const flatDocNodes = useMemo(() => nodes.map(apiNodeToLocal), [nodes]);

  const showTree = tab === "all" && !search && filterTags.length === 0;

  useEffect(() => {
    if (!selectedNodeId || !showTree) return;

    const selectedRelPath = flatDocNodes.find(
      (node) => node.id === selectedNodeId,
    )?.relPath;
    if (!selectedRelPath) return;
    const pathsToExpand: string[] = [selectedRelPath];
    let currentPath: string | null = selectedRelPath;
    while (currentPath) {
      const parentPath = parentRelPathOf(currentPath);
      if (parentPath) {
        pathsToExpand.push(parentPath);
      }
      currentPath = parentPath;
    }

    setExpandedFolders((prev) => {
      const allExist = pathsToExpand.every((path) => prev.has(path));
      if (allExist) return prev;

      const next = new Set(prev);
      for (const path of pathsToExpand) {
        next.add(path);
      }
      return next;
    });
  }, [selectedNodeId, showTree, flatDocNodes]);

  const toggleFolder = useCallback((relPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) next.delete(relPath);
      else next.add(relPath);
      return next;
    });
  }, []);

  const handleCreateFolder = useCallback(
    (parentRelPath?: string) => {
      onCreateFolder(parentRelPath);
      if (parentRelPath)
        setExpandedFolders((prev) => new Set([...prev, parentRelPath]));
    },
    [onCreateFolder],
  );

  const handleCreateDocInFolder = useCallback(
    (type: DocNodeType, parentRelPath?: string) => {
      if (parentRelPath)
        setExpandedFolders((prev) => new Set([...prev, parentRelPath]));
      onCreateNode(type, parentRelPath);
    },
    [onCreateNode],
  );

  const sortMenuItems: DropdownMenuItem[] = useMemo(() => {
    const fieldItems: DropdownMenuItem[] = (
      ["updatedAt", "createdAt", "title", "wordCount"] as SortField[]
    ).map((field) => ({
      key: field,
      label: t(SORT_LABEL_KEYS[field]),
      icon:
        sortField === field ? (
          <Check size={14} />
        ) : (
          <span className="inline-block w-3.5" />
        ),
      onClick: () => onSetSortField(field),
    }));
    const dirItems: DropdownMenuItem[] = [
      {
        key: "asc",
        label: t("sidebar.asc"),
        icon:
          sortDir === "asc" ? (
            <Check size={14} />
          ) : (
            <span className="inline-block w-3.5" />
          ),
        onClick: () => onSetSortDir("asc"),
      },
      {
        key: "desc",
        label: t("sidebar.desc"),
        icon:
          sortDir === "desc" ? (
            <Check size={14} />
          ) : (
            <span className="inline-block w-3.5" />
          ),
        onClick: () => onSetSortDir("desc"),
      },
    ];
    return [...fieldItems, { type: "divider" as const }, ...dirItems];
  }, [sortField, sortDir, onSetSortField, onSetSortDir, t]);

  const isArchived = tab === "archived";
  const activeSpace = spaces.find((space) => space.id === spaceId);
  const spaceMenuItems: DropdownMenuItem[] = [
    ...spaces.map((space) => ({
      key: space.id,
      label: space.name,
      icon:
        space.id === spaceId ? (
          <Check size={14} />
        ) : (
          <span className="inline-block w-3.5" />
        ),
      onClick: () => onSelectSpace(space.id),
    })),
    { type: "divider" as const },
    {
      key: "new-space",
      label: t("spaceSidebar.newSpace"),
      icon: <Plus size={14} />,
      onClick: onCreateSpace,
    },
  ];

  const treeActions = {
    selectedRelPath: selectedNodeId,
    onSelectNode,
    onFavoriteDoc: onFavoriteNode,
    onDeleteNode,
    onCreateDoc: handleCreateDocInFolder,
    onCreateSubfolder: handleCreateFolder,
    onStartRename: (node: DocNode) => setRenamingRelPath(node.relPath),
    onCommitRename: (relPath: string, name: string) => {
      onUpdateNode(relPath, name);
      setRenamingRelPath(null);
    },
    onCancelRename: () => setRenamingRelPath(null),
    renamingRelPath,
    expandedFolders,
    onToggleExpand: toggleFolder,
    onMoveNode,
    moveTargets: flatDocNodes.filter((node) => node.type === "folder"),
    onNodeHover: tip.enter,
    onNodeLeave: tip.leave,
  };

  return (
    <div
      className="flex shrink-0 flex-col overflow-hidden border-r border-border-base bg-surface-sidebar transition-[width] duration-200 ease-out"
      style={{ width: collapsed ? 40 : 256 }}
    >
      {collapsed ? (
        <div className="flex w-10 flex-col items-center py-2">
          <button
            type="button"
            className="cursor-pointer rounded p-1.5 text-fg-muted hover:bg-fill-tertiary"
            onClick={onToggleCollapsed}
            title={t("sidebar.expand")}
          >
            <PanelLeft size={16} />
          </button>
        </div>
      ) : (
        <div className="flex w-64 flex-col">
      <div className="flex items-center gap-1 border-b border-border-subtle px-2 py-2">
        <Dropdown
          menu={{ items: spaceMenuItems }}
          trigger={["click"]}
          placement="bottomLeft"
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold text-fg-primary hover:bg-fill-tertiary"
          >
            <span className="min-w-0 flex-1 truncate">
              {activeSpace?.name ?? t("header.root")}
            </span>
            <ChevronsUpDown size={14} className="shrink-0 text-fg-muted" />
          </button>
        </Dropdown>
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded p-1.5 text-fg-muted hover:bg-fill-tertiary hover:text-fg-secondary"
          onClick={onSpaceSettings}
          title={t("spaceSidebar.settings")}
        >
          <Settings size={15} />
        </button>
      </div>
      <div className="flex items-center gap-1 px-3 py-2">
        <div className="min-w-0 flex-1">
          <Input
            size="small"
            placeholder={t("sidebar.searchPlaceholder")}
            prefix={<Search size={14} className="text-fg-muted" />}
            value={search}
            onChange={(e) => onSetSearch(e.target.value)}
          />
        </div>
        <Dropdown
          menu={{ items: sortMenuItems }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded p-1 text-fg-muted hover:bg-fill-tertiary"
            title={t("sidebar.sort")}
          >
            <ArrowUpDown size={14} />
          </button>
        </Dropdown>
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded p-1 text-fg-muted hover:bg-fill-tertiary"
          onClick={onToggleCollapsed}
          title={t("sidebar.collapse")}
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-0.5 px-2 pb-2">
        {NAV_ITEM_KEYS.map((item) => {
          const isActive = tab === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-accent-subtle font-medium text-accent-text"
                  : "text-fg-secondary hover:bg-fill-tertiary",
              )}
              onClick={() => onSetTab(item.key)}
            >
              <Icon
                size={16}
                className={cn(
                  isActive ? "text-accent-text" : "text-fg-muted",
                )}
              />
              {t(item.labelKey)}
            </button>
          );
        })}
      </div>

      {tab === "all" && (
        <div className="flex items-center gap-1 px-3 pt-1 pb-1">
          <span className="flex-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">
            {t("sidebar.myDocuments")}
          </span>
          <Dropdown
            menu={{
              items: [
                {
                  key: "doc",
                  label: t("docs.newDocument"),
                  icon: <FileText size={14} />,
                  onClick: () => onCreateNode("notion"),
                },
                {
                  key: "sheet",
                  label: t("docs.newSheet"),
                  icon: <Sheet size={14} />,
                  onClick: () => onCreateNode("sheet"),
                },
                {
                  key: "mind",
                  label: t("docs.newMind"),
                  icon: <BrainCircuit size={14} />,
                  onClick: () => onCreateNode("mind"),
                },
                {
                  key: "slide",
                  label: t("docs.newSlide"),
                  icon: <Presentation size={14} />,
                  onClick: () => onCreateNode("slide"),
                },
                {
                  key: "whiteboard",
                  label: t("docs.newWhiteboard"),
                  icon: <PenTool size={14} />,
                  onClick: () => onCreateNode("whiteboard"),
                },
                {
                  key: "base",
                  label: t("docs.newBase"),
                  icon: <Table2 size={14} />,
                  onClick: () => onCreateNode("base"),
                },
                {
                  key: "markdown",
                  label: t("docs.newMarkdown"),
                  icon: <FileCode size={14} />,
                  onClick: () => onCreateNode("markdown"),
                },
                {
                  key: "folder",
                  label: t("docs.newFolder"),
                  icon: <FolderPlus size={14} />,
                  onClick: () => handleCreateFolder(),
                },
              ],
            }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <button
              type="button"
              className="cursor-pointer rounded p-0.5 text-fg-muted hover:text-accent-text"
              title={t("docs.newDocument")}
            >
              <Plus size={14} />
            </button>
          </Dropdown>
        </div>
      )}

      {tab === "all" && (
        <DocSidebarTagFilter
          availableTags={availableTags}
          filterTags={filterTags}
          onToggleTag={(tag) =>
            onSetFilterTags(
              filterTags.includes(tag)
                ? filterTags.filter((t) => t !== tag)
                : [...filterTags, tag],
            )
          }
          onClearTags={() => onSetFilterTags([])}
        />
      )}

      <section
        className="flex-1 overflow-y-auto"
        onMouseLeave={tip.leave}
        aria-label="Document tree"
      >
        {isLoadingNodes ? (
          <div className="flex justify-center py-8">
            <Spin size="small" />
          </div>
        ) : nodes.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-fg-muted">
            {isArchived
              ? t("sidebar.emptyArchived")
              : search
                ? t("sidebar.emptySearch")
                : tab === "favorites"
                  ? t("sidebar.emptyFavorites")
                  : t("sidebar.emptyDefault")}
          </div>
        ) : showTree ? (
          <div className="flex flex-col px-1.5 py-1">
            {flatDocNodes.map((node) => (
              <LazyTreeNode
                key={node.relPath}
                spaceId={spaceId}
                node={node}
                depth={0}
                actions={treeActions}
              />
            ))}
          </div>
        ) : isArchived ? (
          <div className="flex flex-col gap-0.5 px-1.5 py-1">
            {flatDocNodes.map((node) => (
              <ArchivedNodeRow
                key={node.relPath}
                node={node}
                isActive={node.id === selectedNodeId}
                onClick={() => onSelectNode(node)}
                onRestore={() => onRestoreNode(node.id)}
                onPermanentDelete={() => onPermanentDeleteNode(node.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 px-1.5 py-1">
            {flatDocNodes.map((node) => (
              <NodeTreeItem
                key={node.relPath}
                node={node}
                depth={0}
                hasChildren={node.type === "folder"}
                isExpanded={expandedFolders.has(node.relPath)}
                {...treeActions}
              />
            ))}
          </div>
        )}
        {tip.mounted && tip.hovered && (
          <DocNodeTipPanel
            hovered={tip.hovered}
            visible={tip.visible}
            sliding={tip.sliding}
            refs={tip.refs}
            floatingStyles={tip.floatingStyles}
            cancelLeave={tip.cancelLeave}
            leave={tip.leave}
          />
        )}
      </section>
        </div>
      )}
    </div>
  );
}
