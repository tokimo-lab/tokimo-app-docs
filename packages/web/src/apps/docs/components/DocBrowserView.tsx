/**
 * DocBrowserView — Feishu-style file browser for the doc app.
 *
 * Shown when no document is selected. Displays folder contents
 * (subfolders as cards + documents as a table) with breadcrumb navigation.
 */

import {
  cn,
  Dropdown,
  type DropdownMenuItem,
  Empty,
} from "@tokiomo/components";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Copy,
  FileText,
  Folder,
  FolderPlus,
  Heart,
  MoreHorizontal,
  MoveRight,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMessage } from "@/system";
import type { DocNode, DocNodeType } from "../lib/doc-node";
import { getAncestorChain, untitledI18nKey } from "../lib/doc-node";
import type { SortDir, SortField } from "./DocSidebar";

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

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHr < 24) return `${diffHr} 小时前`;

  const isThisYear = d.getFullYear() === now.getFullYear();
  if (isThisYear) {
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatWordCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万字`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k字`;
  return `${count} 字`;
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

// ── Folder card ────────────────────────────────────────────────────────────

function FolderCard({
  node,
  onOpen,
  onRename,
  onDelete,
  onCreateDoc,
}: {
  node: DocNode;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onCreateDoc: () => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [localName, setLocalName] = useState(node.title);

  const menuItems: DropdownMenuItem[] = useMemo(
    () => [
      {
        key: "new-doc",
        label: "新建文档",
        icon: <Plus size={14} />,
        onClick: () => onCreateDoc(),
      },
      { key: "d1", type: "divider" as const },
      {
        key: "rename",
        label: "重命名",
        icon: <Pencil size={14} />,
        onClick: () => {
          setLocalName(node.title);
          setIsRenaming(true);
        },
      },
      { key: "d2", type: "divider" as const },
      {
        key: "delete",
        label: "删除文件夹",
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => {
          if (
            window.confirm(
              `确定删除文件夹「${node.title}」？其中的文档将移至根目录。`,
            )
          ) {
            onDelete();
          }
        },
      },
    ],
    [node.title, onCreateDoc, onDelete],
  );

  return (
    <Dropdown
      trigger={["contextMenu"]}
      menu={{ items: menuItems }}
      placement="bottomLeft"
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: folder card */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click container */}
      <div
        className="group flex cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-fill-secondary px-3 py-2.5 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
        onClick={isRenaming ? undefined : onOpen}
      >
        <Folder size={20} className="shrink-0 text-yellow-500" />
        {isRenaming ? (
          <input
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={() => {
              if (localName.trim() && localName !== node.title) {
                onRename(localName.trim());
              }
              setIsRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setIsRenaming(false);
            }}
            className="min-w-0 flex-1 rounded border border-blue-400 bg-transparent px-1 text-sm outline-none"
            // biome-ignore lint/a11y/noAutofocus: rename input
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm text-fg-primary">
            {node.icon ? `${node.icon} ` : ""}
            {node.title}
          </span>
        )}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation wrapper */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation wrapper */}
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown
            menu={{ items: menuItems }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <button
              type="button"
              className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-fill-tertiary group-hover:opacity-100"
            >
              <MoreHorizontal size={14} className="text-fg-muted" />
            </button>
          </Dropdown>
        </div>
      </div>
    </Dropdown>
  );
}

// ── Document row ───────────────────────────────────────────────────────────

function DocRow({
  node,
  allFolders,
  onClick,
  onFavorite,
  onDelete,
  onMove,
  onCopyId,
  isTrash,
}: {
  node: DocNode;
  allFolders: DocNode[];
  onClick: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onMove: (folderId: string | null) => void;
  onCopyId: () => void;
  isTrash: boolean;
}) {
  const { t } = useTranslation();
  const moveChildren: DropdownMenuItem[] = useMemo(() => {
    const items: DropdownMenuItem[] = [
      {
        key: "root",
        label: "根目录",
        icon: <Folder size={14} />,
        onClick: () => onMove(null),
      },
    ];
    for (const f of allFolders) {
      if (f.id !== node.parentId) {
        items.push({
          key: f.id,
          label: f.icon ? `${f.icon} ${f.title}` : f.title,
          icon: <Folder size={14} className="text-yellow-500" />,
          onClick: () => onMove(f.id),
        });
      }
    }
    return items;
  }, [allFolders, node.parentId, onMove]);

  const menuItems: DropdownMenuItem[] = useMemo(
    () =>
      isTrash
        ? [
            {
              key: "delete",
              label: "永久删除",
              icon: <Trash2 size={14} />,
              danger: true,
              onClick: onDelete,
            },
          ]
        : [
            {
              key: "fav",
              label: node.isFavorite ? "取消收藏" : "收藏",
              icon: <Heart size={14} />,
              onClick: onFavorite,
            },
            {
              key: "move",
              label: "移动到…",
              icon: <MoveRight size={14} />,
              children: moveChildren,
            },
            { key: "d1", type: "divider" as const },
            {
              key: "copy-id",
              label: "复制文档 ID",
              icon: <Copy size={14} />,
              onClick: onCopyId,
            },
            { key: "d2", type: "divider" as const },
            {
              key: "delete",
              label: "删除",
              icon: <Trash2 size={14} />,
              danger: true,
              onClick: onDelete,
            },
          ],
    [node.isFavorite, isTrash, moveChildren, onFavorite, onDelete, onCopyId],
  );

  const displayTitle = node.title || t(untitledI18nKey(node.type));

  return (
    <Dropdown
      trigger={["contextMenu"]}
      menu={{ items: menuItems }}
      placement="bottomLeft"
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: doc row */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click container */}
      <div
        className="group flex cursor-pointer items-center border-b border-border-subtle py-2 transition-colors hover:bg-fill-tertiary"
        onClick={onClick}
      >
        {/* Icon + Title */}
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <FileText
            size={16}
            className={cn(
              "shrink-0",
              isTrash ? "text-fg-muted" : "text-blue-500",
            )}
          />
          <span
            className={cn(
              "truncate text-sm",
              isTrash ? "text-fg-muted line-through" : "text-fg-primary",
            )}
          >
            {node.icon ? `${node.icon} ` : ""}
            {displayTitle}
          </span>
          {node.isFavorite && !isTrash && (
            <Star
              size={12}
              className="shrink-0 fill-yellow-400 text-yellow-400"
            />
          )}
        </div>
        {/* Modified */}
        <div className="w-36 text-xs text-fg-muted">
          {formatDate(node.updatedAt)}
        </div>
        {/* Word count */}
        <div className="w-24 text-xs text-fg-muted">
          {formatWordCount(node.wordCount ?? 0)}
        </div>
        {/* Actions */}
        <div className="w-10 text-right">
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation wrapper */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation wrapper */}
          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown
              menu={{ items: menuItems }}
              trigger={["click"]}
              placement="bottomRight"
            >
              <button
                type="button"
                className="rounded p-0.5 opacity-0 transition-opacity hover:bg-fill-quaternary group-hover:opacity-100"
              >
                <MoreHorizontal size={14} className="text-fg-muted" />
              </button>
            </Dropdown>
          </div>
        </div>
      </div>
    </Dropdown>
  );
}
