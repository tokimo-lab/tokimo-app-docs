/**
 * DocSidebarTree — Tree node components for the doc sidebar.
 *
 * Extracted from DocSidebar to keep each file under 500 lines.
 */

import { cn, Dropdown, type DropdownMenuItem } from "@tokiomo/components";
import {
  Check,
  ChevronDown,
  ChevronRight,
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
  const [showActions, setShowActions] = useState(false);

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

  return (
    <div>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: folder row with action buttons */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover container for folder actions */}
      <div
        className={cn(
          "group flex w-full cursor-pointer items-center gap-1 rounded-md py-1.5 pr-2 text-left text-sm transition-colors",
          "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onToggleFolder(node.folder.id)}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-400">
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

        <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
          {isExpanded ? <FolderOpen size={15} /> : <Folder size={15} />}
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
            className="min-w-0 flex-1 rounded border border-sky-300 bg-white px-1 py-0 text-sm outline-none dark:border-sky-700 dark:bg-zinc-800"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate font-medium">
            {node.folder.icon ? `${node.folder.icon} ` : ""}
            {node.folder.name}
          </span>
        )}

        {showActions && !isRenaming && (
          // biome-ignore lint/a11y/noStaticElementInteractions: stop propagation container
          <div
            className="flex shrink-0 items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="rounded p-0.5 text-zinc-400 hover:text-sky-500"
              onClick={() => onCreateDoc(node.folder.id)}
              title="在此文件夹新建文档"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              className="rounded p-0.5 text-zinc-400 hover:text-sky-500"
              onClick={() => onCreateSubfolder(node.folder.id)}
              title="新建子文件夹"
            >
              <FolderPlus size={13} />
            </button>
            <button
              type="button"
              className="rounded p-0.5 text-zinc-400 hover:text-sky-500"
              onClick={() => onStartRename(node.folder)}
              title="重命名"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              className="rounded p-0.5 text-zinc-400 hover:text-red-500"
              onClick={() => onDeleteFolder(node.folder.id)}
              title="删除文件夹"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
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
              className="py-1 text-xs text-zinc-400 italic"
              style={{ paddingLeft: `${(depth + 1) * 16 + 28}px` }}
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
  const [showActions, setShowActions] = useState(false);

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

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: doc row with nested action buttons
    // biome-ignore lint/a11y/noStaticElementInteractions: hover container for doc actions
    <div
      className={cn(
        "group flex w-full cursor-pointer items-center gap-2 rounded-md py-2 pr-2.5 text-left text-sm transition-colors",
        isActive
          ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
      )}
      style={{ paddingLeft: `${depth * 16 + 28}px` }}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          {doc.isPinned && (
            <Pin size={12} className="shrink-0 text-amber-500" />
          )}
          <span className="truncate font-medium">
            {doc.icon ? `${doc.icon} ` : ""}
            {doc.title || "无标题"}
          </span>
          {doc.isFavorite && (
            <Heart size={12} className="shrink-0 fill-red-500 text-red-500" />
          )}
        </div>
        <span className="text-xs text-zinc-400">
          {formatRelativeTime(doc.updatedAt)}
          {doc.wordCount > 0 && ` · ${doc.wordCount} 字`}
        </span>
      </div>

      {showActions && (
        <div
          role="toolbar"
          className="flex shrink-0 items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="rounded p-0.5 text-zinc-400 hover:text-amber-500"
            onClick={onFavorite}
            title={doc.isFavorite ? "取消收藏" : "收藏"}
          >
            <Heart size={14} />
          </button>
          <Dropdown
            menu={{ items: moveMenuItems }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <button
              type="button"
              className="rounded p-0.5 text-zinc-400 hover:text-sky-500"
              title="移动到文件夹"
            >
              <FolderInput size={14} />
            </button>
          </Dropdown>
          <button
            type="button"
            className="rounded p-0.5 text-zinc-400 hover:text-red-500"
            onClick={onDelete}
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
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
  const [showActions, setShowActions] = useState(false);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: doc row with nested action buttons
    // biome-ignore lint/a11y/noStaticElementInteractions: hover container for doc actions
    <div
      className={cn(
        "group flex w-full cursor-pointer items-center gap-2 rounded-md py-2 pr-2.5 pl-7 text-left text-sm transition-colors",
        isActive
          ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
      )}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium text-zinc-400 dark:text-zinc-500">
          {doc.icon ? `${doc.icon} ` : ""}
          {doc.title || "无标题"}
        </span>
        <span className="text-xs text-zinc-400">
          {formatRelativeTime(doc.updatedAt)}
          {doc.wordCount > 0 && ` · ${doc.wordCount} 字`}
        </span>
      </div>

      {showActions && (
        <div
          role="toolbar"
          className="flex shrink-0 items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="rounded p-0.5 text-zinc-400 hover:text-green-500"
            onClick={onRestore}
            title="恢复"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            className="rounded p-0.5 text-zinc-400 hover:text-red-500"
            onClick={onPermanentDelete}
            title="永久删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
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
