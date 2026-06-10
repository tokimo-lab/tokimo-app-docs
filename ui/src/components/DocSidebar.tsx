import { cn, Dropdown, type DropdownMenuItem, Input, Spin } from "@tokimo/ui";
import {
  ArrowUpDown,
  BrainCircuit,
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
  Sheet,
  Star,
  Table2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocNodeListItem } from "@/generated/rust-api";
import { api } from "@/generated/rust-api";
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
  onRestoreNode: (relPath: string) => void;
  onPermanentDeleteNode: (relPath: string) => void;
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

const SORT_LABELS: Record<SortField, string> = {
  updatedAt: "更新时间",
  createdAt: "创建时间",
  title: "标题",
  wordCount: "字数",
};

const NAV_ITEMS: { key: SidebarTab; label: string; icon: typeof FileText }[] = [
  { key: "all", label: "全部文档", icon: FileText },
  { key: "favorites", label: "收藏", icon: Star },
  { key: "archived", label: "归档", icon: Trash2 },
];

export function DocSidebar({
  spaceId,
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

    const pathsToExpand: string[] = [selectedNodeId];
    let currentPath: string | null = selectedNodeId;
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
  }, [selectedNodeId, showTree]);

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
      label: SORT_LABELS[field],
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
        label: "升序",
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
        label: "降序",
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
  }, [sortField, sortDir, onSetSortField, onSetSortDir]);

  const isArchived = tab === "archived";

  if (collapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center border-r border-border-base bg-surface-base/50 py-2">
        <button
          type="button"
          className="cursor-pointer rounded p-1.5 text-fg-muted hover:bg-fill-tertiary"
          onClick={onToggleCollapsed}
          title="展开侧栏"
        >
          <PanelLeft size={16} />
        </button>
      </div>
    );
  }

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
    onNodeHover: tip.enter,
    onNodeLeave: tip.leave,
  };

  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-border-base bg-surface-base/50">
      <div className="flex items-center gap-1 px-3 py-2">
        <div className="min-w-0 flex-1">
          <Input
            size="small"
            placeholder="搜索文档…"
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
            title="排序"
          >
            <ArrowUpDown size={14} />
          </button>
        </Dropdown>
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded p-1 text-fg-muted hover:bg-fill-tertiary"
          onClick={onToggleCollapsed}
          title="收起侧栏"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-0.5 px-2 pb-2">
        {NAV_ITEMS.map((item) => {
          const isActive = tab === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-[var(--accent-subtle)] font-medium text-[var(--accent)]"
                  : "text-fg-secondary hover:bg-fill-tertiary",
              )}
              onClick={() => onSetTab(item.key)}
            >
              <Icon
                size={16}
                className={cn(
                  isActive ? "text-[var(--accent)]" : "text-fg-muted",
                )}
              />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "all" && (
        <div className="flex items-center gap-1 px-3 pt-1 pb-1">
          <span className="flex-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">
            我的文档
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
              className="cursor-pointer rounded p-0.5 text-fg-muted hover:text-[var(--accent)]"
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
              ? "归档为空"
              : search
                ? "没有匹配的文档"
                : tab === "favorites"
                  ? "暂无收藏文档"
                  : "暂无文档，点击上方新建"}
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
                isActive={node.relPath === selectedNodeId}
                onClick={() => onSelectNode(node)}
                onRestore={() => onRestoreNode(node.relPath)}
                onPermanentDelete={() => onPermanentDeleteNode(node.relPath)}
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
  );
}
