/**
 * DocSidebar — Feishu-style sidebar for the doc app.
 *
 * Layout (top → bottom):
 *   1. Header: New button + sort + sidebar collapse
 *   2. Search input
 *   3. Navigation items: 全部 · 最近 · 收藏 · 回收站
 *   4. Section header: 我的文档 with +doc / +folder actions
 *   5. Folder tree (all tab) or flat doc list (other tabs)
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
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { DocFolderOutput, DocListItem } from "@/generated/rust-api";
import { api } from "@/generated/rust-api";
import { useMessage } from "@/system";
import {
  ArchivedDocRow,
  buildFolderTree,
  DocListItemRow,
  FolderTreeNode,
} from "./DocSidebarTree";

// ── Exported types ─────────────────────────────────────────────────────────

export type SidebarTab = "all" | "recent" | "favorites" | "trash";
export type SortField = "updatedAt" | "createdAt" | "title" | "wordCount";
export type SortDir = "asc" | "desc";

// ── Internal types ─────────────────────────────────────────────────────────

interface DocSidebarProps {
  appId: string;
  docs: DocListItem[];
  isLoadingDocs: boolean;
  selectedDocId: string | null;
  onSelectDoc: (id: string) => void;
  tab: SidebarTab;
  onSetTab: (tab: SidebarTab) => void;
  search: string;
  onSetSearch: (search: string) => void;
  onCreateDoc: (folderId?: string) => void;
  isCreatingDoc: boolean;
  onFavoriteDoc: (id: string) => void;
  onDeleteDoc: (id: string) => void;
  onRestoreDoc: (id: string) => void;
  onPermanentDeleteDoc: (id: string) => void;
  onRefreshDocs: () => void;
  sortField: SortField;
  sortDir: SortDir;
  onSetSortField: (field: SortField) => void;
  onSetSortDir: (dir: SortDir) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  filterTags: string[];
  onSetFilterTags: (tags: string[]) => void;
  /** Navigate the browser view to a folder */
  currentFolderId: string | null;
  onNavigateFolder: (folderId: string | null) => void;
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
  docs,
  isLoadingDocs,
  selectedDocId,
  onSelectDoc,
  tab,
  onSetTab,
  search,
  onSetSearch,
  onCreateDoc,
  isCreatingDoc,
  onFavoriteDoc,
  onDeleteDoc,
  onRestoreDoc,
  onPermanentDeleteDoc,
  onRefreshDocs,
  sortField,
  sortDir,
  onSetSortField,
  onSetSortDir,
  collapsed,
  onToggleCollapsed,
  filterTags,
  onSetFilterTags,
  currentFolderId,
  onNavigateFolder,
}: DocSidebarProps) {
  const message = useMessage();

  // ── Folder data ──────────────────────────────────────────────
  const foldersQuery = api.doc.listFolders.useQuery(
    { appId },
    { enabled: !!appId },
  );
  const folders = foldersQuery.data ?? [];

  // ── Tags data ───────────────────────────────────────────────
  const tagsQuery = api.doc.listTags.useQuery({ appId }, { enabled: !!appId });
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

  // ── Folder mutations ─────────────────────────────────────────
  const createFolderMut = api.doc.createFolder.useMutation({
    onSuccess: () => {
      foldersQuery.refetch();
      message.success("文件夹已创建");
    },
    onError: () => message.error("创建文件夹失败"),
  });
  const updateFolderMut = api.doc.updateFolder.useMutation({
    onSuccess: () => foldersQuery.refetch(),
  });
  const deleteFolderMut = api.doc.deleteFolder.useMutation({
    onSuccess: () => {
      foldersQuery.refetch();
      onRefreshDocs();
      message.success("文件夹已删除");
    },
    onError: () => message.error("删除文件夹失败"),
  });
  const moveMut = api.doc.move.useMutation({
    onSuccess: () => {
      onRefreshDocs();
      message.success("文档已移动");
    },
    onError: () => message.error("移动失败"),
  });

  const createFolderRef = useRef(createFolderMut);
  createFolderRef.current = createFolderMut;
  const updateFolderRef = useRef(updateFolderMut);
  updateFolderRef.current = updateFolderMut;
  const deleteFolderRef = useRef(deleteFolderMut);
  deleteFolderRef.current = deleteFolderMut;
  const moveRef = useRef(moveMut);
  moveRef.current = moveMut;

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
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);

  const startRename = useCallback((folder: DocFolderOutput) => {
    setRenamingFolderId(folder.id);
  }, []);

  const commitRename = useCallback((folderId: string, name: string) => {
    updateFolderRef.current.mutate({ id: folderId, name });
    setRenamingFolderId(null);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingFolderId(null);
  }, []);

  // ── Create folder ────────────────────────────────────────────
  const handleCreateFolder = useCallback(
    (parentId?: string) => {
      createFolderRef.current.mutate({
        appId,
        name: "新文件夹",
        parentId: parentId ?? null,
      });
      if (parentId) {
        setExpandedFolders((prev) => new Set([...prev, parentId]));
      }
    },
    [appId],
  );

  const handleDeleteFolder = useCallback((folderId: string) => {
    if (window.confirm("确定删除此文件夹？文件夹内的文档将移至根目录。")) {
      deleteFolderRef.current.mutate({ id: folderId });
    }
  }, []);

  const handleMoveDoc = useCallback(
    (docId: string, folderId: string | null) => {
      moveRef.current.mutate({ id: docId, folderId });
    },
    [],
  );

  const handleCreateDocInFolder = useCallback(
    (folderId?: string) => {
      if (folderId) {
        setExpandedFolders((prev) => new Set([...prev, folderId]));
      }
      onCreateDoc(folderId);
    },
    [onCreateDoc],
  );

  // ── Build tree ───────────────────────────────────────────────
  const tree = useMemo(() => buildFolderTree(folders, docs), [folders, docs]);

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
        <Dropdown
          menu={{
            items: [
              {
                key: "doc",
                label: "新建文档",
                icon: <FileText size={14} />,
                onClick: () => onCreateDoc(),
              },
              {
                key: "folder",
                label: "新建文件夹",
                icon: <FolderPlus size={14} />,
                onClick: () => handleCreateFolder(),
              },
            ],
          }}
          trigger={["click"]}
          placement="bottomLeft"
        >
          <button
            type="button"
            disabled={isCreatingDoc}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <Plus size={14} />
            新建
          </button>
        </Dropdown>
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
          <button
            type="button"
            className="rounded p-0.5 text-fg-muted hover:text-blue-600 dark:hover:text-blue-400"
            onClick={() => onCreateDoc()}
            title="新建文档"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="rounded p-0.5 text-fg-muted hover:text-blue-600 dark:hover:text-blue-400"
            onClick={() => handleCreateFolder()}
            title="新建文件夹"
          >
            <FolderPlus size={14} />
          </button>
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
      <div className="flex-1 overflow-y-auto">
        {isLoadingDocs ? (
          <div className="flex justify-center py-8">
            <Spin size="small" />
          </div>
        ) : docs.length === 0 && folders.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-fg-muted">
            {isTrash
              ? "回收站为空"
              : search
                ? "没有匹配的文档"
                : tab === "favorites"
                  ? "暂无收藏文档"
                  : "暂无文档，点击上方新建"}
          </div>
        ) : showTree && !search && filterTags.length === 0 ? (
          <div className="flex flex-col gap-0.5 px-1.5 py-1">
            {tree.rootFolders.map((node) => (
              <FolderTreeNode
                key={node.folder.id}
                node={node}
                depth={0}
                selectedDocId={selectedDocId}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
                onSelectDoc={onSelectDoc}
                onFavoriteDoc={onFavoriteDoc}
                onDeleteDoc={onDeleteDoc}
                onCreateDoc={handleCreateDocInFolder}
                onCreateSubfolder={handleCreateFolder}
                onStartRename={startRename}
                onCommitRename={commitRename}
                onCancelRename={cancelRename}
                onDeleteFolder={handleDeleteFolder}
                onMoveDoc={handleMoveDoc}
                renamingFolderId={renamingFolderId}
                allFolders={folders}
                activeFolderId={currentFolderId}
                onNavigateFolder={onNavigateFolder}
              />
            ))}
            {tree.rootDocs.map((doc) => (
              <DocListItemRow
                key={doc.id}
                doc={doc}
                depth={0}
                isActive={doc.id === selectedDocId}
                onClick={() => onSelectDoc(doc.id)}
                onFavorite={() => onFavoriteDoc(doc.id)}
                onDelete={() => onDeleteDoc(doc.id)}
                onMove={handleMoveDoc}
                allFolders={folders}
              />
            ))}
          </div>
        ) : isTrash ? (
          <div className="flex flex-col gap-0.5 px-1.5 py-1">
            {docs.map((doc) => (
              <ArchivedDocRow
                key={doc.id}
                doc={doc}
                isActive={doc.id === selectedDocId}
                onClick={() => onSelectDoc(doc.id)}
                onRestore={() => onRestoreDoc(doc.id)}
                onPermanentDelete={() => onPermanentDeleteDoc(doc.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 px-1.5 py-1">
            {docs.map((doc) => (
              <DocListItemRow
                key={doc.id}
                doc={doc}
                depth={0}
                isActive={doc.id === selectedDocId}
                onClick={() => onSelectDoc(doc.id)}
                onFavorite={() => onFavoriteDoc(doc.id)}
                onDelete={() => onDeleteDoc(doc.id)}
                onMove={handleMoveDoc}
                allFolders={folders}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
