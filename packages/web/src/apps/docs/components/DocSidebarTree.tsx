/**
 * DocSidebarTree — Unified tree node components for the doc sidebar.
 *
 * All node types (folder, document, slide, sheet, form, …) share the same
 * visual row style.  Only the icon differs.  Folders are grouped at the top
 * of each level.  Metadata is shown via a hover tooltip (DocNodeTip).
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
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DocFolderOutput } from "@/generated/rust-api";
import type { DocNode, DocTreeNode } from "../lib/doc-node";
import { formatRelativeTime } from "../lib/doc-node";

// ── Re-exports for consumers ───────────────────────────────────────────────

export type { DocTreeNode } from "../lib/doc-node";
export { buildNodeTree, mergeFoldersAndDocs } from "../lib/doc-node";

// ── Icon helper ────────────────────────────────────────────────────────────

function NodeIcon({
  node,
  isExpanded,
  isActive,
  size = 15,
}: {
  node: DocNode;
  isExpanded?: boolean;
  isActive?: boolean;
  size?: number;
}) {
  if (node.type === "folder") {
    return isExpanded ? (
      <FolderOpen
        size={size}
        className="text-yellow-500 dark:text-yellow-400"
      />
    ) : (
      <Folder size={size} className="text-yellow-500 dark:text-yellow-400" />
    );
  }
  return (
    <FileText
      size={size}
      className={cn(
        "shrink-0",
        isActive
          ? "text-blue-500 dark:text-blue-400"
          : "text-blue-400 dark:text-blue-500",
      )}
    />
  );
}

// ── NodeTreeItem — unified row for folders & docs ──────────────────────────

export function NodeTreeItem({
  treeNode,
  depth,
  selectedNodeId,
  expandedFolders,
  onToggleExpand,
  onSelectNode,
  onFavoriteDoc,
  onDeleteNode,
  onCreateDoc,
  onCreateSubfolder,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onMoveDoc,
  renamingNodeId,
  allFolders,
  onNodeHover,
  onNodeLeave,
}: {
  treeNode: DocTreeNode;
  depth: number;
  selectedNodeId: string | null;
  expandedFolders: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelectNode: (node: DocNode) => void;
  onFavoriteDoc: (id: string) => void;
  onDeleteNode: (node: DocNode) => void;
  onCreateDoc: (folderId?: string) => void;
  onCreateSubfolder: (parentId: string) => void;
  onStartRename: (node: DocNode) => void;
  onCommitRename: (nodeId: string, name: string) => void;
  onCancelRename: () => void;
  onMoveDoc: (docId: string, folderId: string | null) => void;
  renamingNodeId: string | null;
  allFolders: DocFolderOutput[];
  onNodeHover?: (el: HTMLElement, node: DocNode) => void;
  onNodeLeave?: () => void;
}) {
  const { node, children } = treeNode;
  const isFolder = node.type === "folder";
  const isExpanded = expandedFolders.has(node.id);
  const isActive = selectedNodeId === node.id;
  const isRenaming = renamingNodeId === node.id;
  const hasChildren = children.length > 0;

  // ── Inline rename ────────────────────────────────────────────
  const [localName, setLocalName] = useState(node.title);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const escapedRef = useRef(false);

  useEffect(() => {
    if (isRenaming) {
      setLocalName(node.title);
      escapedRef.current = false;
      requestAnimationFrame(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    }
  }, [isRenaming, node.title]);

  // ── Context menu ─────────────────────────────────────────────
  const contextMenuItems: DropdownMenuItem[] = useMemo(() => {
    if (isFolder) {
      return [
        {
          key: "new-doc",
          label: "新建文档",
          icon: <Plus size={14} />,
          onClick: () => onCreateDoc(node.id),
        },
        {
          key: "new-subfolder",
          label: "新建子文件夹",
          icon: <FolderPlus size={14} />,
          onClick: () => onCreateSubfolder(node.id),
        },
        { type: "divider" as const },
        {
          key: "rename",
          label: "重命名",
          icon: <Pencil size={14} />,
          onClick: () => onStartRename(node),
        },
        {
          key: "delete",
          label: "删除文件夹",
          icon: <Trash2 size={14} />,
          danger: true,
          onClick: () => onDeleteNode(node),
        },
      ];
    }
    const moveItems: DropdownMenuItem[] = [
      {
        key: "root",
        label: "根目录",
        icon:
          node.parentId === null ? (
            <Check size={14} />
          ) : (
            <span className="inline-block w-3.5" />
          ),
        onClick: () => onMoveDoc(node.id, null),
      },
    ];
    if (allFolders.length > 0) {
      moveItems.push({ type: "divider" as const });
      for (const folder of allFolders) {
        moveItems.push({
          key: folder.id,
          label: `${folder.icon ? `${folder.icon} ` : ""}${folder.name}`,
          icon:
            node.parentId === folder.id ? (
              <Check size={14} />
            ) : (
              <span className="inline-block w-3.5" />
            ),
          onClick: () => onMoveDoc(node.id, folder.id),
        });
      }
    }
    return [
      {
        key: "favorite",
        label: node.isFavorite ? "取消收藏" : "收藏",
        icon: <Heart size={14} />,
        onClick: () => onFavoriteDoc(node.id),
      },
      {
        key: "rename",
        label: "重命名",
        icon: <Pencil size={14} />,
        onClick: () => onStartRename(node),
      },
      {
        key: "move",
        label: "移动到…",
        icon: <FolderInput size={14} />,
        children: moveItems,
      },
      { type: "divider" as const },
      {
        key: "copy-id",
        label: "复制 ID",
        icon: <Copy size={14} />,
        onClick: () => navigator.clipboard.writeText(node.id),
      },
      { type: "divider" as const },
      {
        key: "delete",
        label: "删除",
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => onDeleteNode(node),
      },
    ];
  }, [
    isFolder,
    node,
    allFolders,
    onCreateDoc,
    onCreateSubfolder,
    onStartRename,
    onDeleteNode,
    onFavoriteDoc,
    onMoveDoc,
  ]);

  const handleClick = () => {
    if (isFolder) {
      onToggleExpand(node.id);
    }
    onSelectNode(node);
  };

  return (
    <div>
      <Dropdown
        menu={{ items: contextMenuItems }}
        trigger={["contextMenu"]}
        placement="bottomLeft"
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: tree row */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: hover container */}
        <div
          className={cn(
            "group flex w-full cursor-pointer items-center gap-1 rounded-md py-1 pr-2 text-left text-sm transition-colors",
            isActive
              ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : "text-fg-secondary hover:bg-fill-tertiary",
          )}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={handleClick}
          onMouseEnter={(e) => onNodeHover?.(e.currentTarget, node)}
          onMouseLeave={() => onNodeLeave?.()}
        >
          {/* Expand/collapse chevron */}
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-fg-muted">
            {isFolder || hasChildren ? (
              isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            ) : (
              <span className="w-3.5" />
            )}
          </span>

          {/* Node icon */}
          <span className="shrink-0 text-fg-muted">
            <NodeIcon node={node} isExpanded={isExpanded} isActive={isActive} />
          </span>

          {/* Title or rename input */}
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
                  if (trimmed && trimmed !== node.title) {
                    onCommitRename(node.id, trimmed);
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
            <span className="min-w-0 flex-1 truncate">
              {node.icon ? `${node.icon} ` : ""}
              {node.title || "无标题"}
            </span>
          )}

          {/* Hover toolbar */}
          {!isRenaming && (
            <div
              className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="toolbar"
            >
              {isFolder ? (
                <button
                  type="button"
                  className="rounded p-0.5 text-fg-muted hover:text-blue-500"
                  onClick={() => onCreateDoc(node.id)}
                  title="新建文档"
                >
                  <Plus size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded p-0.5 text-fg-muted hover:text-amber-500"
                  onClick={() => onFavoriteDoc(node.id)}
                  title={node.isFavorite ? "取消收藏" : "收藏"}
                >
                  <Heart size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      </Dropdown>

      {/* Children */}
      {isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <NodeTreeItem
              key={child.node.id}
              treeNode={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              expandedFolders={expandedFolders}
              onToggleExpand={onToggleExpand}
              onSelectNode={onSelectNode}
              onFavoriteDoc={onFavoriteDoc}
              onDeleteNode={onDeleteNode}
              onCreateDoc={onCreateDoc}
              onCreateSubfolder={onCreateSubfolder}
              onStartRename={onStartRename}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onMoveDoc={onMoveDoc}
              renamingNodeId={renamingNodeId}
              allFolders={allFolders}
              onNodeHover={onNodeHover}
              onNodeLeave={onNodeLeave}
            />
          ))}
        </div>
      )}
      {isExpanded && isFolder && children.length === 0 && (
        <div
          className="py-1 text-xs text-fg-muted italic"
          style={{ paddingLeft: `${(depth + 1) * 20 + 28}px` }}
        >
          空文件夹
        </div>
      )}
    </div>
  );
}

// ── ArchivedNodeRow (trash view) ───────────────────────────────────────────

export function ArchivedNodeRow({
  node,
  isActive,
  onClick,
  onRestore,
  onPermanentDelete,
}: {
  node: DocNode;
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
        "group flex w-full cursor-pointer items-center gap-2 rounded-md py-1 pr-2.5 pl-7 text-left text-sm transition-colors",
        isActive
          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          : "text-fg-secondary hover:bg-fill-tertiary",
      )}
      onClick={onClick}
    >
      <span className="shrink-0 text-fg-muted opacity-50">
        <NodeIcon node={node} isActive={false} />
      </span>
      <span className="min-w-0 flex-1 truncate text-fg-muted">
        {node.icon ? `${node.icon} ` : ""}
        {node.title || "无标题"}
      </span>
      <span className="shrink-0 text-[11px] text-fg-muted">
        {formatRelativeTime(node.updatedAt)}
      </span>

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
