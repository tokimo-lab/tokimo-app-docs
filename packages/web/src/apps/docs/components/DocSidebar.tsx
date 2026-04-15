/** DocSidebar — Feishu-style sidebar for the doc app. */

import {
  cn,
  Dropdown,
  type DropdownMenuItem,
  Input,
  Spin,
} from "@tokiomo/components";
import {
  ArrowUpDown,
  BrainCircuit,
  Check,
  Clock,
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
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocNodeListItem } from "@/generated/rust-api";
import { api } from "@/generated/rust-api";
import type { DocNode, DocNodeType } from "../lib/doc-node";
import { DocNodeTipPanel, useDocNodeTip } from "./DocNodeTip";
import { DocSidebarTagFilter } from "./DocSidebarTagFilter";
import { ArchivedNodeRow, NodeTreeItem } from "./DocSidebarTree";
import { TreeDragContext } from "./tree-drag-context";
import { useDocSidebarNodes } from "./useDocSidebarNodes";

// ── Exported types ─────────────────────────────────────────────────────────

export type SidebarTab = "all" | "recent" | "favorites" | "trash";
export type SortField = "updatedAt" | "createdAt" | "title" | "wordCount";
export type SortDir = "asc" | "desc";

// ── Internal types ─────────────────────────────────────────────────────────

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
  onCreateNode: (type: DocNodeType, parentId?: string) => void;
  onCreateFolder: (parentId?: string) => void;
  onFavoriteNode: (id: string) => void;
  onDeleteNode: (node: DocNode) => void;
  onUpdateNode: (id: string, title: string) => void;
  onMoveNode: (id: string, parentId: string | null, sortOrder?: number) => void;
  onRestoreNode: (id: string) => void;
  onPermanentDeleteNode: (id: string) => void;
  sortField: SortField;
  sortDir: SortDir;
  onSetSortField: (field: SortField) => void;
  onSetSortDir: (dir: SortDir) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  filterTags: string[];
  onSetFilterTags: (tags: string[]) => void;
}

// ── Sort labels ────────────────────────────────────────────────────────────

const SORT_LABELS: Record<SortField, string> = {
  updatedAt: "更新时间",
  createdAt: "创建时间",
  title: "标题",
  wordCount: "字数",
};

// ── Nav item config ────────────────────────────────────────────────────────

const NAV_ITEMS: {
  key: SidebarTab;
  label: string;
  icon: typeof FileText;
}[] = [
  { key: "all", label: "全部文档", icon: FileText },
  { key: "recent", label: "最近编辑", icon: Clock },
  { key: "favorites", label: "收藏", icon: Star },
  { key: "trash", label: "回收站", icon: Trash2 },
];

// ── DocSidebar ─────────────────────────────────────────────────────────────

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
  onMoveNode,
  onRestoreNode,
  onPermanentDeleteNode,
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
  // ── Tags data ───────────────────────────────────────────────
  const tagsQuery = api.docs.listTags.useQuery(
    { spaceId },
    { enabled: !!spaceId },
  );
  const availableTags = tagsQuery.data ?? [];

  // ── Expand/collapse ──────────────────────────────────────────
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  // ── Rename state ─────────────────────────────────────────────
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);

  const startRename = useCallback((node: DocNode) => {
    setRenamingNodeId(node.id);
  }, []);

  const commitRename = useCallback(
    (nodeId: string, name: string) => {
      onUpdateNode(nodeId, name);
      setRenamingNodeId(null);
    },
    [onUpdateNode],
  );

  const cancelRename = useCallback(() => {
    setRenamingNodeId(null);
  }, []);

  // ── Create folder ────────────────────────────────────────────
  const handleCreateFolder = useCallback(
    (parentId?: string) => {
      onCreateFolder(parentId);
      if (parentId) {
        setExpandedFolders((prev) => new Set([...prev, parentId]));
      }
    },
    [onCreateFolder],
  );

  const handleDeleteNode = useCallback(
    (node: DocNode) => {
      onDeleteNode(node);
    },
    [onDeleteNode],
  );

  const handleCreateDocInFolder = useCallback(
    (type: DocNodeType, folderId?: string) => {
      if (folderId) {
        setExpandedFolders((prev) => new Set([...prev, folderId]));
      }
      onCreateNode(type, folderId);
    },
    [onCreateNode],
  );

  // ── Node tree + DnD ──────────────────────────────────────────
  const {
    flatDocNodes,
    allFolders,
    flatItems,
    handleMoveDoc,
    treeDragValue,
    dnd,
  } = useDocSidebarNodes({
    nodes,
    expandedFolders,
    toggleFolder,
    onMoveNode,
  });

  // ── Hover tooltip ──────────────────────────────────────────
  const tip = useDocNodeTip();

  // ── Sort menu ────────────────────────────────────────────────
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

  const showTree =
    (tab === "all" || tab === "recent") && !search && filterTags.length === 0;
  const isTrash = tab === "trash";

  // ── Collapsed view ───────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center border-r border-border-base bg-surface-base/50 py-2">
        <button
          type="button"
          className="rounded p-1.5 text-fg-muted hover:bg-fill-tertiary"
          onClick={onToggleCollapsed}
          title="展开侧栏"
        >
          <PanelLeft size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-border-base bg-surface-base/50">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 py-2">
        <div className="flex-1" />
        <Dropdown
          menu={{ items: sortMenuItems }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <button
            type="button"
            className="rounded p-1 text-fg-muted hover:bg-fill-tertiary"
            title="排序"
          >
            <ArrowUpDown size={14} />
          </button>
        </Dropdown>
        <button
          type="button"
          className="rounded p-1 text-fg-muted hover:bg-fill-tertiary"
          onClick={onToggleCollapsed}
          title="收起侧栏"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      {/* ── Search ──────────────────────────────────────────── */}
      <div className="px-3 pb-2">
        <Input
          size="small"
          placeholder="搜索文档…"
          prefix={<Search size={14} className="text-fg-muted" />}
          value={search}
          onChange={(e) => onSetSearch(e.target.value)}
        />
      </div>

      {/* ── Nav items ───────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5 px-2 pb-2">
        {NAV_ITEMS.map((item) => {
          const isActive = tab === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "text-fg-secondary hover:bg-fill-tertiary",
              )}
              onClick={() => onSetTab(item.key)}
            >
              <Icon
                size={16}
                className={cn(
                  isActive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-fg-muted",
                )}
              />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* ── Section header: 我的文档 ───────────────────────── */}
      {(tab === "all" || tab === "recent") && (
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
              className="cursor-pointer rounded p-0.5 text-fg-muted hover:text-blue-600 dark:hover:text-blue-400"
              title={t("docs.newDocument")}
            >
              <Plus size={14} />
            </button>
          </Dropdown>
        </div>
      )}

      {/* ── Tag filter ──────────────────────────────────────── */}
      {(tab === "all" || tab === "recent") && (
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

      {/* ── Content ─────────────────────────────────────────── */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: tooltip leave handler */}
      <div className="flex-1 overflow-y-auto" onMouseLeave={tip.leave}>
        {isLoadingNodes ? (
          <div className="flex justify-center py-8">
            <Spin size="small" />
          </div>
        ) : nodes.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-fg-muted">
            {isTrash
              ? "回收站为空"
              : search
                ? "没有匹配的文档"
                : tab === "favorites"
                  ? "暂无收藏文档"
                  : "暂无文档，点击上方新建"}
          </div>
        ) : showTree ? (
          <TreeDragContext.Provider value={treeDragValue}>
            <div ref={dnd.containerRef} className="flex flex-col px-1.5 py-1">
              {flatItems.map((item) => (
                <NodeTreeItem
                  key={item.node.id}
                  node={item.node}
                  depth={item.depth}
                  hasChildren={item.hasChildren}
                  isExpanded={item.isExpanded}
                  selectedNodeId={selectedNodeId}
                  onToggleExpand={toggleFolder}
                  onSelectNode={onSelectNode}
                  onFavoriteDoc={onFavoriteNode}
                  onDeleteNode={handleDeleteNode}
                  onCreateDoc={handleCreateDocInFolder}
                  onCreateSubfolder={handleCreateFolder}
                  onStartRename={startRename}
                  onCommitRename={commitRename}
                  onCancelRename={cancelRename}
                  onMoveDoc={handleMoveDoc}
                  renamingNodeId={renamingNodeId}
                  allFolders={allFolders}
                  onNodeHover={tip.enter}
                  onNodeLeave={tip.leave}
                />
              ))}
            </div>
          </TreeDragContext.Provider>
        ) : isTrash ? (
          <div className="flex flex-col gap-0.5 px-1.5 py-1">
            {flatDocNodes.map((node) => (
              <ArchivedNodeRow
                key={node.id}
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
                key={node.id}
                node={node}
                depth={0}
                hasChildren={false}
                isExpanded={false}
                selectedNodeId={selectedNodeId}
                onToggleExpand={toggleFolder}
                onSelectNode={onSelectNode}
                onFavoriteDoc={onFavoriteNode}
                onDeleteNode={handleDeleteNode}
                onCreateDoc={handleCreateDocInFolder}
                onCreateSubfolder={handleCreateFolder}
                onStartRename={startRename}
                onCommitRename={commitRename}
                onCancelRename={cancelRename}
                onMoveDoc={handleMoveDoc}
                renamingNodeId={renamingNodeId}
                allFolders={allFolders}
                onNodeHover={tip.enter}
                onNodeLeave={tip.leave}
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
      </div>
    </div>
  );
}
