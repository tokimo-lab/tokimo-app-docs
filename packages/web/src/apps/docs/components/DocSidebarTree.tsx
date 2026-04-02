/**
 * DocSidebarTree — Tree node components for the doc sidebar.
 *
 * Features: folder tree with expand/collapse, context menus,
 * doc items with actions, archived doc rows.
 */

import { cn, Dropdown, type DropdownMenuItem } from "@tokiomo/components";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Heart,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DocFolderOutput, DocListItem } from "@/generated/rust-api";

// ── Types ──────────────────────────────────────────────────────────────────

export interface FolderNode {
  folder: DocFolderOutput;
  children: FolderNode[];
  docs: DocListItem[];
}

// ── Tree builder ───────────────────────────────────────────────────────────

export function buildFolderTree(
  folders: DocFolderOutput[],
  docs: DocListItem[],
): { rootFolders: FolderNode[]; rootDocs: DocListItem[] } {
  const folderIdSet = new Set(folders.map((f) => f.id));

  const docsByFolder = new Map<string | null, DocListItem[]>();
  for (const doc of docs) {
    const key =
      doc.folderId && folderIdSet.has(doc.folderId) ? doc.folderId : null;
    const list = docsByFolder.get(key) ?? [];
    list.push(doc);
    docsByFolder.set(key, list);
  }

  const foldersByParent = new Map<string | null, DocFolderOutput[]>();
  for (const folder of folders) {
    const key = folder.parentId;
    const list = foldersByParent.get(key) ?? [];
    list.push(folder);
    foldersByParent.set(key, list);
  }

  function buildNodes(parentId: string | null): FolderNode[] {
    const children = [...(foldersByParent.get(parentId) ?? [])];
    children.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    return children.map((folder) => ({
      folder,
      children: buildNodes(folder.id),
      docs: docsByFolder.get(folder.id) ?? [],
    }));
  }

  return {
    rootFolders: buildNodes(null),
    rootDocs: docsByFolder.get(null) ?? [],
  };
}

// ── FolderTreeNode ─────────────────────────────────────────────────────────

export function FolderTreeNode({
  node,
  depth,
  selectedDocId,
  expandedFolders,
  onToggleFolder,
  onSelectDoc,
  onFavoriteDoc,
  onDeleteDoc,
  onCreateDoc,
  onCreateSubfolder,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDeleteFolder,
  onMoveDoc,
  renamingFolderId,
  allFolders,
}: {
  node: FolderNode;
  depth: number;
  selectedDocId: string | null;
  expandedFolders: Set<string>;
  onToggleFolder: (id: string) => void;
  onSelectDoc: (id: string) => void;
  onFavoriteDoc: (id: string) => void;
  onDeleteDoc: (id: string) => void;
  onCreateDoc: (folderId?: string) => void;
  onCreateSubfolder: (parentId: string) => void;
  onStartRename: (folder: DocFolderOutput) => void;
  onCommitRename: (folderId: string, name: string) => void;
  onCancelRename: () => void;
  onDeleteFolder: (id: string) => void;
  onMoveDoc: (docId: string, folderId: string | null) => void;
  renamingFolderId: string | null;
  allFolders: DocFolderOutput[];
}) {
  const isExpanded = expandedFolders.has(node.folder.id);
  const isRenaming = renamingFolderId === node.folder.id;
  const hasContent = node.children.length > 0 || node.docs.length > 0;

  // ── Inline rename ────────────────────────────────────────────
  const [localName, setLocalName] = useState(node.folder.name);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const escapedRef = useRef(false);

  useEffect(() => {
    if (isRenaming) {
      setLocalName(node.folder.name);
      escapedRef.current = false;
      requestAnimationFrame(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    }
  }, [isRenaming, node.folder.name]);

  // ── Context menu items ───────────────────────────────────────
  const contextMenuItems: DropdownMenuItem[] = useMemo(
    () => [
      {
        key: "new-doc",
        label: "新建文档",
        icon: <Plus size={14} />,
        onClick: () => onCreateDoc(node.folder.id),
      },
      {
        key: "new-subfolder",
        label: "新建子文件夹",
        icon: <FolderPlus size={14} />,
        onClick: () => onCreateSubfolder(node.folder.id),
      },
      { type: "divider" },
      {
        key: "rename",
        label: "重命名",
        icon: <Pencil size={14} />,
        onClick: () => onStartRename(node.folder),
      },
      {
        key: "delete",
        label: "删除文件夹",
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => onDeleteFolder(node.folder.id),
      },
    ],
    [
      node.folder,
      onCreateDoc,
      onCreateSubfolder,
      onStartRename,
      onDeleteFolder,
    ],
  );

  return (
    <div>
      <Dropdown
        menu={{ items: contextMenuItems }}
        trigger={["contextMenu"]}
        placement="bottomLeft"
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: folder row */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: hover container */}
        <div
          className={cn(
            "group flex w-full cursor-pointer items-center gap-1 rounded-md py-1 pr-2 text-left text-sm transition-colors",
            "text-fg-secondary hover:bg-fill-tertiary",
          )}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => onToggleFolder(node.folder.id)}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-fg-muted">
            {hasContent ? (
              isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            ) : (
              <span className="w-3.5" />
            )}
          </span>

          <span className="shrink-0 text-fg-muted">
            {isExpanded ? (
              <FolderOpen
                size={15}
                className="text-blue-500 dark:text-blue-400"
              />
            ) : (
              <Folder size={15} className="text-blue-500 dark:text-blue-400" />
            )}
          </span>

          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={() => {
                if (escapedRef.current) {
                  escapedRef.current = false;
                  onCancelRename();
                } else {
                  const trimmed = localName.trim();
                  if (trimmed && trimmed !== node.folder.name) {
                    onCommitRename(node.folder.id, trimmed);
                  } else {
                    onCancelRename();
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  escapedRef.current = true;
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 rounded border border-blue-400 bg-surface-elevated px-1.5 py-0 text-sm outline-none dark:border-blue-600"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate font-medium">
              {node.folder.icon ? `${node.folder.icon} ` : ""}
              {node.folder.name}
            </span>
          )}

          {!isRenaming && (
            <div
              className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="toolbar"
            >
              <button
                type="button"
                className="rounded p-0.5 text-fg-muted hover:text-blue-500"
                onClick={() => onCreateDoc(node.folder.id)}
                title="新建文档"
              >
                <Plus size={14} />
              </button>
            </div>
          )}
        </div>
      </Dropdown>

      {isExpanded && (
        <div>
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              selectedDocId={selectedDocId}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onSelectDoc={onSelectDoc}
              onFavoriteDoc={onFavoriteDoc}
              onDeleteDoc={onDeleteDoc}
              onCreateDoc={onCreateDoc}
              onCreateSubfolder={onCreateSubfolder}
              onStartRename={onStartRename}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onDeleteFolder={onDeleteFolder}
              onMoveDoc={onMoveDoc}
              renamingFolderId={renamingFolderId}
              allFolders={allFolders}
            />
          ))}
          {node.docs.map((doc) => (
            <DocListItemRow
              key={doc.id}
              doc={doc}
              depth={depth + 1}
              isActive={doc.id === selectedDocId}
              onClick={() => onSelectDoc(doc.id)}
              onFavorite={() => onFavoriteDoc(doc.id)}
              onDelete={() => onDeleteDoc(doc.id)}
              onMove={onMoveDoc}
              allFolders={allFolders}
            />
          ))}
          {node.children.length === 0 && node.docs.length === 0 && (
            <div
              className="py-1 text-xs text-fg-muted italic"
              style={{ paddingLeft: `${(depth + 1) * 20 + 28}px` }}
            >
              空文件夹
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DocListItemRow ─────────────────────────────────────────────────────────

export function DocListItemRow({
  doc,
  depth,
  isActive,
  onClick,
  onFavorite,
  onDelete,
  onMove,
  allFolders,
}: {
  doc: DocListItem;
  depth: number;
  isActive: boolean;
  onClick: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onMove: (docId: string, folderId: string | null) => void;
  allFolders: DocFolderOutput[];
}) {
  const moveMenuItems: DropdownMenuItem[] = useMemo(() => {
    const items: DropdownMenuItem[] = [
      {
        key: "root",
        label: "根目录",
        icon:
          doc.folderId === null ? (
            <Check size={14} />
          ) : (
            <span className="inline-block w-3.5" />
          ),
        onClick: () => onMove(doc.id, null),
      },
    ];
    if (allFolders.length > 0) {
      items.push({ type: "divider" });
      for (const folder of allFolders) {
        items.push({
          key: folder.id,
          label: `${folder.icon ? `${folder.icon} ` : ""}${folder.name}`,
          icon:
            doc.folderId === folder.id ? (
              <Check size={14} />
            ) : (
              <span className="inline-block w-3.5" />
            ),
          onClick: () => onMove(doc.id, folder.id),
        });
      }
    }
    return items;
  }, [allFolders, doc.id, doc.folderId, onMove]);

  // ── Context menu ─────────────────────────────────────────────
  const contextMenuItems: DropdownMenuItem[] = useMemo(
    () => [
      {
        key: "favorite",
        label: doc.isFavorite ? "取消收藏" : "收藏",
        icon: <Heart size={14} />,
        onClick: onFavorite,
      },
      {
        key: "move",
        label: "移动到…",
        icon: <FolderInput size={14} />,
        children: moveMenuItems,
      },
      { type: "divider" },
      {
        key: "copy-id",
        label: "复制文档 ID",
        icon: <Copy size={14} />,
        onClick: () => navigator.clipboard.writeText(doc.id),
      },
      { type: "divider" },
      {
        key: "delete",
        label: "删除",
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: onDelete,
      },
    ],
    [doc.id, doc.isFavorite, onFavorite, onDelete, moveMenuItems],
  );

  return (
    <Dropdown
      menu={{ items: contextMenuItems }}
      trigger={["contextMenu"]}
      placement="bottomLeft"
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: doc row */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover container */}
      <div
        className={cn(
          "group flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2.5 text-left text-sm transition-colors",
          isActive
            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            : "text-fg-secondary hover:bg-fill-tertiary",
        )}
        style={{ paddingLeft: `${depth * 20 + 28}px` }}
        onClick={onClick}
      >
        <FileText
          size={15}
          className={cn(
            "shrink-0",
            isActive ? "text-blue-500 dark:text-blue-400" : "text-fg-muted",
          )}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            {doc.isPinned && (
              <Pin size={11} className="shrink-0 text-amber-500" />
            )}
            <span className="truncate font-medium">
              {doc.icon ? `${doc.icon} ` : ""}
              {doc.title || "无标题"}
            </span>
            {doc.isFavorite && (
              <Heart size={11} className="shrink-0 fill-red-500 text-red-500" />
            )}
          </div>
          <span className="text-[11px] text-fg-muted">
            {formatRelativeTime(doc.updatedAt)}
            {doc.wordCount > 0 && ` · ${doc.wordCount} 字`}
          </span>
        </div>

        <div
          role="toolbar"
          className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="rounded p-0.5 text-fg-muted hover:text-amber-500"
            onClick={onFavorite}
            title={doc.isFavorite ? "取消收藏" : "收藏"}
          >
            <Heart size={13} />
          </button>
          <button
            type="button"
            className="rounded p-0.5 text-fg-muted hover:text-red-500"
            onClick={onDelete}
            title="删除"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </Dropdown>
  );
}

// ── ArchivedDocRow (trash view) ────────────────────────────────────────────

export function ArchivedDocRow({
  doc,
  isActive,
  onClick,
  onRestore,
  onPermanentDelete,
}: {
  doc: DocListItem;
  isActive: boolean;
  onClick: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
}) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: doc row
    // biome-ignore lint/a11y/noStaticElementInteractions: hover container
    <div
      className={cn(
        "group flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2.5 pl-7 text-left text-sm transition-colors",
        isActive
          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          : "text-fg-secondary hover:bg-fill-tertiary",
      )}
      onClick={onClick}
    >
      <FileText size={15} className="shrink-0 text-fg-muted opacity-50" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium text-fg-muted">
          {doc.icon ? `${doc.icon} ` : ""}
          {doc.title || "无标题"}
        </span>
        <span className="text-[11px] text-fg-muted">
          {formatRelativeTime(doc.updatedAt)}
          {doc.wordCount > 0 && ` · ${doc.wordCount} 字`}
        </span>
      </div>

      <div
        role="toolbar"
        className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="rounded p-0.5 text-fg-muted hover:text-green-500"
          onClick={onRestore}
          title="恢复"
        >
          <RotateCcw size={14} />
        </button>
        <button
          type="button"
          className="rounded p-0.5 text-fg-muted hover:text-red-500"
          onClick={onPermanentDelete}
          title="永久删除"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Utils ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} 天前`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} 周前`;
  return date.toLocaleDateString("zh-CN");
}
