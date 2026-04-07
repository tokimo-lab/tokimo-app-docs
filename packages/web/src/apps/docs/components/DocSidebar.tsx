/**
 * DocSidebar — Feishu-style sidebar for the doc app.
 *
 * Layout (top → bottom):
 *   1. Header: sort + sidebar collapse
 *   2. Search input
 *   3. Navigation items: 全部 · 最近 · 收藏 · 回收站
 *   4. Section header: 我的文档 with +doc / +folder actions
 *   5. Unified node tree (folders + docs as sibling nodes)
 *   6. Tags filter (collapsible)
 */

import {
  cn,
  Dropdown,
  type DropdownMenuItem,
  Input,
  Spin,
} from "@tokiomo/components";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  FolderPlus,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Search,
  Sheet,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocNodeListItem } from "@/generated/rust-api";
import { api } from "@/generated/rust-api";
import type { DocNode, DocNodeType } from "../lib/doc-node";
import { apiNodeToLocal, buildNodeTree } from "../lib/doc-node";
import { DocNodeTipPanel, useDocNodeTip } from "./DocNodeTip";
import { ArchivedNodeRow, NodeTreeItem } from "./DocSidebarTree";
import type { DropIndicator, DropPosition } from "./tree-drag-context";
import { collectDescendantIds, TreeDragContext } from "./tree-drag-context";

// ── Exported types ─────────────────────────────────────────────────────────

export type SidebarTab = "all" | "recent" | "favorites" | "trash";
export type SortField = "updatedAt" | "createdAt" | "title" | "wordCount";
export type SortDir = "asc" | "desc";

// ── Internal types ─────────────────────────────────────────────────────────

interface DocSidebarProps {
  appId: string;
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
  appId,
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
  const tagsQuery = api.docs.listTags.useQuery({ appId }, { enabled: !!appId });
  const availableTags = tagsQuery.data ?? [];
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const toggleFilterTag = useCallback(
    (tag: string) => {
      onSetFilterTags(
        filterTags.includes(tag)
          ? filterTags.filter((t) => t !== tag)
          : [...filterTags, tag],
      );
    },
    [filterTags, onSetFilterTags],
  );

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

  // ── Build unified tree ────────────────────────────────────────
  const localNodes = useMemo(() => nodes.map(apiNodeToLocal), [nodes]);
  const treeNodes = useMemo(() => buildNodeTree(localNodes), [localNodes]);

  // Flat doc nodes for non-tree views (recent, favorites, search)
  const flatDocNodes = localNodes;

  // All folders (for "move to" submenu)
  const allFolders = useMemo(
    () => localNodes.filter((n) => n.type === "folder"),
    [localNodes],
  );

  // ── Hover tooltip ──────────────────────────────────────────
  const tip = useDocNodeTip();

  // ── Drag-and-drop state ─────────────────────────────────────
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [rootDragOver, setRootDragOver] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
    null,
  );

  const dragDescendantIds = useMemo(() => {
    if (!dragNodeId) return new Set<string>();
    return collectDescendantIds(treeNodes, dragNodeId);
  }, [dragNodeId, treeNodes]);

  const treeDragValue = useMemo(
    () => ({
      dragNodeId,
      dragDescendantIds,
      dropIndicator,
      startDrag: setDragNodeId,
      endDrag: () => {
        setDragNodeId(null);
        setRootDragOver(false);
        setDropIndicator(null);
      },
      setDropIndicator,
    }),
    [dragNodeId, dragDescendantIds, dropIndicator],
  );

  // Resolve drop position to (parentId, sortOrder)
  const resolveDropTarget = useCallback(
    (
      targetNodeId: string,
      position: DropPosition,
    ): { parentId: string | null; sortOrder: number } => {
      // Find the target node and its siblings
      const targetNode = localNodes.find((n) => n.id === targetNodeId);
      if (!targetNode) return { parentId: null, sortOrder: 0 };

      if (position === "inside") {
        return { parentId: targetNodeId, sortOrder: 0 };
      }

      // "before" or "after" — insert among target's siblings
      const siblingParentId = targetNode.parentId;
      const siblings = localNodes
        .filter((n) => n.parentId === siblingParentId && n.id !== dragNodeId)
        .sort((a, b) =>
          a.sortOrder !== b.sortOrder
            ? a.sortOrder - b.sortOrder
            : a.title.localeCompare(b.title),
        );
      const idx = siblings.findIndex((n) => n.id === targetNodeId);

      if (position === "before") {
        return {
          parentId: siblingParentId,
          sortOrder: idx >= 0 ? siblings[idx].sortOrder : 0,
        };
      }
      // "after"
      return {
        parentId: siblingParentId,
        sortOrder: idx >= 0 ? siblings[idx].sortOrder + 1 : siblings.length,
      };
    },
    [localNodes, dragNodeId],
  );

  const handleMoveDoc = useCallback(
    (docId: string, targetId: string | null, position?: DropPosition) => {
      setDropIndicator(null);
      if (targetId && position && position !== "inside") {
        const { parentId, sortOrder } = resolveDropTarget(targetId, position);
        onMoveNode(docId, parentId, sortOrder);
      } else {
        // "inside" or root drop: move into target as child
        onMoveNode(docId, targetId);
      }
    },
    [onMoveNode, resolveDropTarget],
  );

  const handleRootDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!dragNodeId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setRootDragOver(true);
      setDropIndicator(null);
    },
    [dragNodeId],
  );

  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setRootDragOver(false);
      setDropIndicator(null);
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId) {
        // Drop at root, append at end
        const rootSiblings = localNodes.filter(
          (n) => n.parentId === null && n.id !== draggedId,
        );
        const maxOrder = rootSiblings.reduce(
          (max, n) => Math.max(max, n.sortOrder),
          -1,
        );
        onMoveNode(draggedId, null, maxOrder + 1);
      }
      setDragNodeId(null);
    },
    [onMoveNode, localNodes],
  );

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
      {availableTags.length > 0 && (tab === "all" || tab === "recent") && (
        <div className="px-3 pb-1">
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded px-1 py-1 text-xs font-medium text-fg-muted hover:text-fg-secondary"
            onClick={() => setTagsExpanded((v) => !v)}
          >
            {tagsExpanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
            <Tag size={12} />
            <span>标签</span>
            {filterTags.length > 0 && (
              <span className="ml-auto rounded-full bg-blue-100 px-1.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {filterTags.length}
              </span>
            )}
          </button>

          {filterTags.length > 0 && !tagsExpanded && (
            <div className="mt-1 flex flex-wrap gap-1">
              {filterTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {tag}
                  <button
                    type="button"
                    className="ml-0.5 rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-800/50"
                    onClick={() => toggleFilterTag(tag)}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {tagsExpanded && (
            <div className="mt-1 flex flex-wrap gap-1">
              {availableTags.map((tag) => {
                const isActive = filterTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] transition-colors",
                      isActive
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        : "bg-fill-tertiary text-fg-muted hover:bg-fill-secondary",
                    )}
                    onClick={() => toggleFilterTag(tag)}
                  >
                    {tag}
                  </button>
                );
              })}
              {filterTags.length > 0 && (
                <button
                  type="button"
                  className="rounded-full px-2 py-0.5 text-[11px] text-fg-muted hover:text-fg-secondary"
                  onClick={() => onSetFilterTags([])}
                >
                  清除
                </button>
              )}
            </div>
          )}
        </div>
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
            <div className="flex flex-col gap-0.5 px-1.5 py-1">
              {treeNodes.map((tn) => (
                <NodeTreeItem
                  key={tn.node.id}
                  treeNode={tn}
                  depth={0}
                  selectedNodeId={selectedNodeId}
                  expandedFolders={expandedFolders}
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
            {/* Root drop zone — visible during drag, drop here to move to root */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: DnD drop target */}
            <div
              className={cn(
                "mx-2 mt-1 rounded-md border-2 border-dashed py-2 text-center text-xs transition-colors",
                dragNodeId
                  ? rootDragOver
                    ? "border-blue-400 bg-blue-50/80 text-blue-600 dark:border-blue-500 dark:bg-blue-900/40 dark:text-blue-400"
                    : "border-gray-300 text-fg-muted dark:border-gray-600"
                  : "hidden",
              )}
              onDragOver={handleRootDragOver}
              onDragLeave={() => setRootDragOver(false)}
              onDrop={handleRootDrop}
            >
              移动到根目录
            </div>
            {/* Extra space at bottom for easier root drops */}
            {dragNodeId && (
              // biome-ignore lint/a11y/noStaticElementInteractions: DnD drop target
              <div
                className="min-h-16"
                onDragOver={handleRootDragOver}
                onDrop={handleRootDrop}
              />
            )}
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
                treeNode={{ node, children: [] }}
                depth={0}
                selectedNodeId={selectedNodeId}
                expandedFolders={expandedFolders}
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
