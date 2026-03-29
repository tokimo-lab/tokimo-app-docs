/**
 * DocSidebar — Folder-tree sidebar for the doc app.
 *
 * Features: folder tree, expand/collapse, folder CRUD,
 * doc-to-folder movement, search, sort, favorites, sidebar collapse.
 */

import {
  Button,
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

export type SidebarTab = "all" | "favorites" | "trash";
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
}

// ── Sort labels ────────────────────────────────────────────────────────────

const SORT_LABELS: Record<SortField, string> = {
  updatedAt: "更新时间",
  createdAt: "创建时间",
  title: "标题",
  wordCount: "字数",
};

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

  // ── Folder mutations (use refs for stable callbacks) ─────────
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

  // ── Delete folder ────────────────────────────────────────────
  const handleDeleteFolder = useCallback((folderId: string) => {
    if (window.confirm("确定删除此文件夹？文件夹内的文档将移至根目录。")) {
      deleteFolderRef.current.mutate({ id: folderId });
    }
  }, []);

  // ── Move doc ─────────────────────────────────────────────────
  const handleMoveDoc = useCallback(
    (docId: string, folderId: string | null) => {
      moveRef.current.mutate({ id: docId, folderId });
    },
    [],
  );

  // ── Create doc in folder (auto-expand) ───────────────────────
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

  const showTree = tab === "all" && !search && filterTags.length === 0;
  const isTrash = tab === "trash";

  // ── Collapsed view ───────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center border-r border-zinc-200 bg-zinc-50/50 py-2 dark:border-zinc-700 dark:bg-zinc-900/50">
        <button
          type="button"
          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          onClick={onToggleCollapsed}
          title="展开侧栏"
        >
          <PanelLeft size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-900/50">
      {/* Header */}
      <div className="flex items-center gap-1 border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
        <Button
          size="small"
          variant="text"
          icon={<Plus size={16} />}
          onClick={() => onCreateDoc()}
          loading={isCreatingDoc}
        >
          新建
        </Button>
        <Button
          size="small"
          variant="text"
          icon={<FolderPlus size={14} />}
          onClick={() => handleCreateFolder()}
          title="新建文件夹"
        />
        <div className="flex-1" />
        <Dropdown
          menu={{ items: sortMenuItems }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <button
            type="button"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
            title="排序"
          >
            <ArrowUpDown size={14} />
          </button>
        </Dropdown>
        <Button
          size="small"
          variant={tab === "favorites" ? "primary" : "text"}
          icon={<Star size={14} />}
          onClick={() => onSetTab(tab === "favorites" ? "all" : "favorites")}
        />
        <Button
          size="small"
          variant={tab === "trash" ? "primary" : "text"}
          icon={<Trash2 size={14} />}
          onClick={() => onSetTab(tab === "trash" ? "all" : "trash")}
          title="回收站"
        />
        <button
          type="button"
          className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
          onClick={onToggleCollapsed}
          title="收起侧栏"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <Input
          size="small"
          placeholder="搜索文档…"
          prefix={<Search size={14} className="text-zinc-400" />}
          value={search}
          onChange={(e) => onSetSearch(e.target.value)}
        />
      </div>

      {/* Tag filter */}
      {availableTags.length > 0 && (
        <div className="border-b border-zinc-200 px-3 pb-2 dark:border-zinc-700">
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded px-1 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
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

          {/* Active filter pills (always visible when there are active filters) */}
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
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700",
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
                  className="rounded-full px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  onClick={() => onSetFilterTags([])}
                >
                  清除
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingDocs ? (
          <div className="flex justify-center py-8">
            <Spin size="small" />
          </div>
        ) : docs.length === 0 && folders.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-zinc-400">
            {isTrash
              ? "回收站为空"
              : search
                ? "没有匹配的文档"
                : "暂无文档，点击上方新建"}
          </div>
        ) : showTree ? (
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
        ) : docs.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-zinc-400">
            {isTrash
              ? "回收站为空"
              : tab === "favorites"
                ? "暂无收藏文档"
                : "没有匹配的文档"}
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
