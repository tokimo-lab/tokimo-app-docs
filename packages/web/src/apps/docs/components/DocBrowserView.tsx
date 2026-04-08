/**
 * DocBrowserView — Feishu-style file browser for the doc app.
 *
 * Shown when no document is selected. Displays folder contents
 * (subfolders as cards + documents as a table) with breadcrumb navigation.
 */

import { cn, Empty } from "@tokiomo/components";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  FileText,
  FolderPlus,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { useMessage } from "@/system";
import type { DocNode, DocNodeType } from "../lib/doc-node";
import { getAncestorChain } from "../lib/doc-node";
import { DocRow } from "./DocRow";
import type { SortDir, SortField } from "./DocSidebar";
import { FolderCard } from "./FolderCard";

// ── Props ──────────────────────────────────────────────────────────────────

interface DocBrowserViewProps {
  nodes: DocNode[];
  currentFolderId: string | null;
  onNavigateFolder: (folderId: string | null) => void;
  onOpenDoc: (docId: string, type: DocNodeType) => void;
  onCreateNode: (type: DocNodeType, parentId?: string) => void;
  onCreateFolder: (parentId?: string) => void;
  onFavoriteNode: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onMoveNode: (id: string, parentId: string | null, sortOrder?: number) => void;
  onUpdateNode: (id: string, title: string) => void;
  sortField: SortField;
  sortDir: SortDir;
  onSetSortField: (field: SortField) => void;
  onSetSortDir: (dir: SortDir) => void;
  isLoading: boolean;
  viewMode: "all" | "recent" | "favorites" | "trash";
}

// ── Component ──────────────────────────────────────────────────────────────

export function DocBrowserView({
  nodes,
  currentFolderId,
  onNavigateFolder,
  onOpenDoc,
  onCreateNode,
  onCreateFolder,
  onFavoriteNode,
  onDeleteNode,
  onMoveNode,
  onUpdateNode,
  sortField,
  sortDir,
  onSetSortField,
  onSetSortDir,
  isLoading,
  viewMode,
}: DocBrowserViewProps) {
  const message = useMessage();

  // Build breadcrumb path
  const breadcrumbPath = useMemo(() => {
    if (!currentFolderId) return [];
    return getAncestorChain(nodes, currentFolderId);
  }, [currentFolderId, nodes]);

  // Filter subfolders of current folder
  const subFolders = useMemo(() => {
    if (viewMode !== "all") return [];
    return nodes
      .filter((n) => n.type === "folder" && n.parentId === currentFolderId)
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
      );
  }, [nodes, currentFolderId, viewMode]);

  // Filter docs in current folder (or all non-folder nodes for special views)
  const visibleDocs = useMemo(() => {
    if (viewMode !== "all") return nodes.filter((n) => n.type !== "folder");
    return nodes.filter(
      (n) => n.type !== "folder" && n.parentId === currentFolderId,
    );
  }, [nodes, currentFolderId, viewMode]);

  // All folders for "move to" submenu
  const allFolders = useMemo(
    () => nodes.filter((n) => n.type === "folder"),
    [nodes],
  );

  const isEmpty = subFolders.length === 0 && visibleDocs.length === 0;

  const handleSortClick = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        onSetSortDir(sortDir === "asc" ? "desc" : "asc");
      } else {
        onSetSortField(field);
        onSetSortDir(field === "title" ? "asc" : "desc");
      }
    },
    [sortField, sortDir, onSetSortField, onSetSortDir],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Breadcrumb ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-border-subtle px-4 py-2.5">
        <div className="flex flex-1 items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => onNavigateFolder(null)}
            className={cn(
              "rounded px-1 py-0.5 transition-colors hover:bg-fill-tertiary",
              !currentFolderId
                ? "font-medium text-fg-primary"
                : "text-fg-muted hover:text-fg-secondary",
            )}
          >
            文档
          </button>
          {breadcrumbPath.map((node) => (
            <span key={node.id} className="flex items-center gap-1">
              <ChevronRight size={14} className="text-fg-muted" />
              <button
                type="button"
                onClick={() => onNavigateFolder(node.id)}
                className={cn(
                  "rounded px-1 py-0.5 transition-colors hover:bg-fill-tertiary",
                  node.id === currentFolderId
                    ? "font-medium text-fg-primary"
                    : "text-fg-muted hover:text-fg-secondary",
                )}
              >
                {node.icon ? `${node.icon} ` : ""}
                {node.title}
              </button>
            </span>
          ))}
          {viewMode === "recent" && (
            <>
              <ChevronRight size={14} className="text-fg-muted" />
              <span className="font-medium text-fg-primary">最近编辑</span>
            </>
          )}
          {viewMode === "favorites" && (
            <>
              <ChevronRight size={14} className="text-fg-muted" />
              <span className="font-medium text-fg-primary">收藏</span>
            </>
          )}
          {viewMode === "trash" && (
            <>
              <ChevronRight size={14} className="text-fg-muted" />
              <span className="font-medium text-fg-primary">回收站</span>
            </>
          )}
        </div>
      </div>

      {/* ── Action bar ──────────────────────────────────────────────── */}
      {viewMode !== "trash" && (
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2">
          <button
            type="button"
            onClick={() => onCreateNode("notion", currentFolderId ?? undefined)}
            className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-fill-secondary px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:bg-fill-tertiary"
          >
            <FileText size={15} className="text-blue-500" />
            新建文档
          </button>
          {viewMode === "all" && (
            <button
              type="button"
              onClick={() => onCreateFolder(currentFolderId ?? undefined)}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-fill-secondary px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:bg-fill-tertiary"
            >
              <FolderPlus size={15} className="text-yellow-500" />
              新建文件夹
            </button>
          )}
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-fg-muted">
            加载中...
          </div>
        ) : isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <Empty
              description={
                viewMode === "trash"
                  ? "回收站为空"
                  : viewMode === "favorites"
                    ? "暂无收藏文档"
                    : "此文件夹为空"
              }
            />
          </div>
        ) : (
          <>
            {/* Folder cards */}
            {subFolders.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 text-xs font-medium text-fg-muted">
                  文件夹
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
                  {subFolders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      node={folder}
                      onOpen={() => onNavigateFolder(folder.id)}
                      onRename={(name) => onUpdateNode(folder.id, name)}
                      onDelete={() => onDeleteNode(folder.id)}
                      onCreateDoc={() => onCreateNode("notion", folder.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Document list table */}
            {visibleDocs.length > 0 && (
              <div>
                {subFolders.length > 0 && (
                  <div className="mb-2 text-xs font-medium text-fg-muted">
                    文档
                  </div>
                )}
                {/* Column headers */}
                <div className="flex items-center border-b border-border-subtle pb-1 text-xs text-fg-muted">
                  <div className="flex-1">
                    <SortableHeader
                      label="名称"
                      field="title"
                      currentField={sortField}
                      currentDir={sortDir}
                      onClick={handleSortClick}
                    />
                  </div>
                  <div className="w-36">
                    <SortableHeader
                      label="修改时间"
                      field="updatedAt"
                      currentField={sortField}
                      currentDir={sortDir}
                      onClick={handleSortClick}
                    />
                  </div>
                  <div className="w-24">
                    <SortableHeader
                      label="字数"
                      field="wordCount"
                      currentField={sortField}
                      currentDir={sortDir}
                      onClick={handleSortClick}
                    />
                  </div>
                  <div className="w-10" />
                </div>
                {/* Doc rows */}
                {visibleDocs.map((doc) => (
                  <DocRow
                    key={doc.id}
                    node={doc}
                    allFolders={allFolders}
                    onClick={() => onOpenDoc(doc.id, doc.type as DocNodeType)}
                    onFavorite={() => onFavoriteNode(doc.id)}
                    onDelete={() => onDeleteNode(doc.id)}
                    onMove={(folderId) => onMoveNode(doc.id, folderId)}
                    onCopyId={() => {
                      navigator.clipboard.writeText(doc.id);
                      message.success("已复制 ID");
                    }}
                    isTrash={viewMode === "trash"}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Sortable column header ─────────────────────────────────────────────────

function SortableHeader({
  label,
  field,
  currentField,
  currentDir,
  onClick,
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onClick: (field: SortField) => void;
}) {
  const isActive = currentField === field;
  return (
    <button
      type="button"
      onClick={() => onClick(field)}
      className={cn(
        "flex items-center gap-0.5 rounded px-1 py-0.5 transition-colors hover:text-fg-secondary",
        isActive && "text-fg-secondary",
      )}
    >
      {label}
      {isActive &&
        (currentDir === "asc" ? (
          <ArrowUp size={12} />
        ) : (
          <ArrowDown size={12} />
        ))}
    </button>
  );
}
