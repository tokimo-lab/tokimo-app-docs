/**
 * DocSidebarTree — Unified tree node components for the doc sidebar.
 *
 * All node types (folder, document, slide, sheet, form, …) share the same
 * visual row style.  Only the icon differs.  Folders are grouped at the top
 * of each level.  Metadata is shown via a hover tooltip (DocNodeTip).
 *
 * DnD uses Pointer Events + CSS transforms (via useTreeDnd hook).
 * Each row is rendered flat (not recursively) — the parent component
 * provides a flat visible-nodes list and this component renders one row.
 */

import { cn, Dropdown, type DropdownMenuItem } from "@tokimo/ui";
import {
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  FolderInput,
  FolderPlus,
  Heart,
  Pencil,
  PenTool,
  Plus,
  Presentation,
  RotateCcw,
  Sheet,
  Table2,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocNode, DocNodeType } from "../lib/doc-node";
import {
  formatRelativeTime,
  sanitizeNodeName,
  untitledI18nKey,
} from "../lib/doc-node";
import { DocNodeIcon } from "./DocNodeIcon";
import type { DropPosition } from "./tree-drag-context";
import { useTreeDrag } from "./tree-drag-context";

// ── Re-exports for consumers ───────────────────────────────────────────────

export type { DocTreeNode } from "../lib/doc-node";
export { buildNodeTree } from "../lib/doc-node";

// ── Icon helper ────────────────────────────────────────────────────────────

function NodeIcon({
  node,
  isExpanded,
  size = 15,
}: {
  node: DocNode;
  isExpanded?: boolean;
  size?: number;
}) {
  return <DocNodeIcon node={node} isExpanded={isExpanded} size={size} />;
}

// ── NodeTreeItem — flat row for a single tree node ─────────────────────────

export function NodeTreeItem({
  node,
  depth,
  hasChildren,
  isExpanded,
  selectedNodeId,
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
  node: DocNode;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  selectedNodeId: string | null;
  onToggleExpand: (id: string) => void;
  onSelectNode: (node: DocNode) => void;
  onFavoriteDoc: (id: string) => void;
  onDeleteNode: (node: DocNode) => void;
  onCreateDoc: (type: DocNodeType, folderId?: string) => void;
  onCreateSubfolder: (parentId: string) => void;
  onStartRename: (node: DocNode) => void;
  onCommitRename: (nodeId: string, name: string) => void;
  onCancelRename: () => void;
  onMoveDoc: (
    docId: string,
    targetId: string | null,
    position?: DropPosition,
  ) => void;
  renamingNodeId: string | null;
  allFolders: DocNode[];
  onNodeHover?: (el: HTMLElement, node: DocNode) => void;
  onNodeLeave?: () => void;
}) {
  const { t } = useTranslation();
  const isFolder = node.type === "folder";
  const isActive = selectedNodeId === node.id;
  const isRenaming = renamingNodeId === node.id;

  // ── Drag-and-drop (from context) ────────────────────────────
  const {
    isDragging,
    getNodeStyle,
    isInsideTarget,
    handlePointerDown,
    shouldSuppressClick,
  } = useTreeDrag();
  const insideMe = isInsideTarget(node.id);

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
          label: t("docs.newDocument"),
          icon: <FileText size={14} />,
          onClick: () => onCreateDoc("notion", node.id),
        },
        {
          key: "new-sheet",
          label: t("docs.newSheet"),
          icon: <Sheet size={14} />,
          onClick: () => onCreateDoc("sheet", node.id),
        },
        {
          key: "new-mind",
          label: t("docs.newMind"),
          icon: <BrainCircuit size={14} />,
          onClick: () => onCreateDoc("mind", node.id),
        },
        {
          key: "new-slide",
          label: t("docs.newSlide"),
          icon: <Presentation size={14} />,
          onClick: () => onCreateDoc("slide", node.id),
        },
        {
          key: "new-whiteboard",
          label: t("docs.newWhiteboard"),
          icon: <PenTool size={14} />,
          onClick: () => onCreateDoc("whiteboard", node.id),
        },
        {
          key: "new-base",
          label: t("docs.newBase"),
          icon: <Table2 size={14} />,
          onClick: () => onCreateDoc("base", node.id),
        },
        {
          key: "new-subfolder",
          label: t("docs.newFolder"),
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
          label: `${folder.icon ? `${folder.icon} ` : ""}${folder.title}`,
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
      ...(isFolder
        ? [
            {
              key: "new-doc",
              label: t("docs.newDocument"),
              icon: <FileText size={14} />,
              onClick: () => onCreateDoc("notion", node.id),
            },
            {
              key: "new-sheet",
              label: t("docs.newSheet"),
              icon: <Sheet size={14} />,
              onClick: () => onCreateDoc("sheet", node.id),
            },
            {
              key: "new-mind",
              label: t("docs.newMind"),
              icon: <BrainCircuit size={14} />,
              onClick: () => onCreateDoc("mind", node.id),
            },
            {
              key: "new-slide",
              label: t("docs.newSlide"),
              icon: <Presentation size={14} />,
              onClick: () => onCreateDoc("slide", node.id),
            },
            {
              key: "new-whiteboard",
              label: t("docs.newWhiteboard"),
              icon: <PenTool size={14} />,
              onClick: () => onCreateDoc("whiteboard", node.id),
            },
            {
              key: "new-base",
              label: t("docs.newBase"),
              icon: <Table2 size={14} />,
              onClick: () => onCreateDoc("base", node.id),
            },
            { type: "divider" as const },
          ]
        : []),
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
    t,
  ]);

  const handleClick = () => {
    // Suppress click after a completed drag
    if (shouldSuppressClick()) return;
    if (isFolder || hasChildren) {
      onToggleExpand(node.id);
    }
    onSelectNode(node);
  };

  return (
    <div
      data-tree-dnd
      style={getNodeStyle(node.id)}
      onPointerDown={(e) => handlePointerDown(node.id, e)}
    >
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
            insideMe &&
              "ring-2 ring-inset ring-[var(--accent)] bg-[var(--accent-subtle)]",
            !insideMe &&
              (isActive
                ? "bg-[var(--accent-subtle)] font-medium text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent)]"
                : "text-fg-secondary hover:bg-fill-tertiary"),
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
            <NodeIcon node={node} isExpanded={isExpanded} />
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
                  const trimmed = sanitizeNodeName(localName);
                  if (trimmed && trimmed !== node.title) {
                    onCommitRename(node.id, trimmed);
                  } else {
                    onCancelRename();
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
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
              className="min-w-0 flex-1 rounded border border-[var(--accent)] bg-surface-elevated px-1.5 py-0 text-sm outline-none dark:border-[var(--accent)]"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate">
              {node.icon ? `${node.icon} ` : ""}
              {node.title || t(untitledI18nKey(node.type))}
            </span>
          )}

          {/* Hover toolbar — hidden during DnD to avoid animation lag */}
          {!isRenaming && !isDragging && (
            <div
              className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="toolbar"
            >
              {isFolder && (
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: "doc",
                        label: t("docs.newDocument"),
                        icon: <FileText size={14} />,
                        onClick: () => onCreateDoc("notion", node.id),
                      },
                      {
                        key: "sheet",
                        label: t("docs.newSheet"),
                        icon: <Sheet size={14} />,
                        onClick: () => onCreateDoc("sheet", node.id),
                      },
                      {
                        key: "mind",
                        label: t("docs.newMind"),
                        icon: <BrainCircuit size={14} />,
                        onClick: () => onCreateDoc("mind", node.id),
                      },
                      {
                        key: "whiteboard",
                        label: t("docs.newWhiteboard"),
                        icon: <PenTool size={14} />,
                        onClick: () => onCreateDoc("whiteboard", node.id),
                      },
                      {
                        key: "folder",
                        label: t("docs.newFolder"),
                        icon: <FolderPlus size={14} />,
                        onClick: () => onCreateSubfolder(node.id),
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
              )}
              <button
                type="button"
                className="cursor-pointer rounded p-0.5 text-fg-muted hover:text-amber-500"
                onClick={() => onFavoriteDoc(node.id)}
                title={node.isFavorite ? "取消收藏" : "收藏"}
              >
                <Heart size={13} />
              </button>
            </div>
          )}
        </div>
      </Dropdown>
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
  const { t } = useTranslation();
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: doc row
    // biome-ignore lint/a11y/noStaticElementInteractions: hover container
    <div
      className={cn(
        "group flex w-full cursor-pointer items-center gap-2 rounded-md py-1 pr-2.5 pl-7 text-left text-sm transition-colors",
        isActive
          ? "bg-[var(--accent-subtle)] text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent-text)]"
          : "text-fg-secondary hover:bg-fill-tertiary",
      )}
      onClick={onClick}
    >
      <span className="shrink-0 text-fg-muted opacity-50">
        <NodeIcon node={node} />
      </span>
      <span className="min-w-0 flex-1 truncate text-fg-muted">
        {node.icon ? `${node.icon} ` : ""}
        {node.title || t(untitledI18nKey(node.type))}
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
          className="cursor-pointer rounded p-0.5 text-fg-muted hover:text-green-500"
          onClick={onRestore}
          title="恢复"
        >
          <RotateCcw size={14} />
        </button>
        <button
          type="button"
          className="cursor-pointer rounded p-0.5 text-fg-muted hover:text-red-500"
          onClick={onPermanentDelete}
          title="永久删除"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
