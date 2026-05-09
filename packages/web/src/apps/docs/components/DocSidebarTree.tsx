import { cn, Dropdown, type DropdownMenuItem, Spin } from "@tokimo/ui";
import {
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
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
import { api } from "@/generated/rust-api";
import type { DocNode, DocNodeType } from "../lib/doc-node";
import {
  apiNodeToLocal,
  formatRelativeTime,
  sanitizeNodeName,
  untitledI18nKey,
} from "../lib/doc-node";
import { DocNodeIcon } from "./DocNodeIcon";

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

interface TreeActions {
  selectedRelPath: string | null;
  onSelectNode: (node: DocNode) => void;
  onFavoriteDoc: (relPath: string) => void;
  onDeleteNode: (node: DocNode) => void;
  onCreateDoc: (type: DocNodeType, parentRelPath?: string) => void;
  onCreateSubfolder: (parentRelPath?: string) => void;
  onStartRename: (node: DocNode) => void;
  onCommitRename: (relPath: string, name: string) => void;
  onCancelRename: () => void;
  renamingRelPath: string | null;
  expandedFolders: Set<string>;
  onToggleExpand: (relPath: string) => void;
  onMoveNode: (srcRelPath: string, destFolderRelPath: string | null) => void;
  onNodeHover?: (el: HTMLElement, node: DocNode) => void;
  onNodeLeave?: () => void;
}

const TREE_DRAG_MIME = "application/x-tokimo-doc-relpath";

export function LazyTreeNode({
  spaceId,
  node,
  depth,
  actions,
}: {
  spaceId: string;
  node: DocNode;
  depth: number;
  actions: TreeActions;
}) {
  const isFolder = node.type === "folder";
  const isExpanded = actions.expandedFolders.has(node.relPath);
  const childQuery = api.docs.list.useQuery(
    { spaceId, path: node.relPath, tab: "all" },
    { enabled: isFolder && isExpanded },
  );
  const children = useMemo(
    () => (childQuery.data?.items ?? []).map(apiNodeToLocal),
    [childQuery.data],
  );

  return (
    <>
      <NodeTreeItem
        node={node}
        depth={depth}
        hasChildren={isFolder}
        isExpanded={isExpanded}
        {...actions}
      />
      {isFolder && isExpanded && (
        <div className="flex flex-col">
          {childQuery.isLoading ? (
            <div
              className="flex items-center gap-2 py-1 text-xs text-fg-muted"
              style={{ paddingLeft: `${(depth + 1) * 20 + 28}px` }}
            >
              <Spin size="small" />
              加载中…
            </div>
          ) : children.length === 0 ? (
            <div
              className="py-1 text-xs text-fg-muted"
              style={{ paddingLeft: `${(depth + 1) * 20 + 28}px` }}
            >
              空文件夹
            </div>
          ) : (
            children.map((child) => (
              <LazyTreeNode
                key={child.relPath}
                spaceId={spaceId}
                node={child}
                depth={depth + 1}
                actions={actions}
              />
            ))
          )}
        </div>
      )}
    </>
  );
}

export function NodeTreeItem({
  node,
  depth,
  hasChildren,
  isExpanded,
  selectedRelPath,
  onToggleExpand,
  onSelectNode,
  onFavoriteDoc,
  onDeleteNode,
  onCreateDoc,
  onCreateSubfolder,
  onStartRename,
  onCommitRename,
  onCancelRename,
  renamingRelPath,
  onMoveNode,
  onNodeHover,
  onNodeLeave,
}: {
  node: DocNode;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
} & TreeActions) {
  const { t } = useTranslation();
  const isFolder = node.type === "folder";
  const isActive = selectedRelPath === node.relPath;
  const isRenaming = renamingRelPath === node.relPath;
  const [localName, setLocalName] = useState(node.title);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const escapedRef = useRef(false);

  useEffect(() => {
    if (!isRenaming) return;
    setLocalName(node.title);
    escapedRef.current = false;
    requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  }, [isRenaming, node.title]);

  const createItems: DropdownMenuItem[] = useMemo(
    () => [
      {
        key: "new-doc",
        label: t("docs.newDocument"),
        icon: <FileText size={14} />,
        onClick: () => onCreateDoc("notion", node.relPath),
      },
      {
        key: "new-sheet",
        label: t("docs.newSheet"),
        icon: <Sheet size={14} />,
        onClick: () => onCreateDoc("sheet", node.relPath),
      },
      {
        key: "new-mind",
        label: t("docs.newMind"),
        icon: <BrainCircuit size={14} />,
        onClick: () => onCreateDoc("mind", node.relPath),
      },
      {
        key: "new-slide",
        label: t("docs.newSlide"),
        icon: <Presentation size={14} />,
        onClick: () => onCreateDoc("slide", node.relPath),
      },
      {
        key: "new-whiteboard",
        label: t("docs.newWhiteboard"),
        icon: <PenTool size={14} />,
        onClick: () => onCreateDoc("whiteboard", node.relPath),
      },
      {
        key: "new-base",
        label: t("docs.newBase"),
        icon: <Table2 size={14} />,
        onClick: () => onCreateDoc("base", node.relPath),
      },
      {
        key: "new-folder",
        label: t("docs.newFolder"),
        icon: <FolderPlus size={14} />,
        onClick: () => onCreateSubfolder(node.relPath),
      },
    ],
    [t, onCreateDoc, onCreateSubfolder, node.relPath],
  );

  const contextMenuItems: DropdownMenuItem[] = useMemo(
    () => [
      ...(isFolder ? [...createItems, { type: "divider" as const }] : []),
      {
        key: "favorite",
        label: node.isFavorite ? "取消收藏" : "收藏",
        icon: <Heart size={14} />,
        onClick: () => onFavoriteDoc(node.relPath),
      },
      {
        key: "rename",
        label: "重命名",
        icon: <Pencil size={14} />,
        onClick: () => onStartRename(node),
      },
      {
        key: "copy",
        label: "复制 relPath",
        icon: <Copy size={14} />,
        onClick: () => navigator.clipboard.writeText(node.relPath),
      },
      { type: "divider" as const },
      {
        key: "delete",
        label: isFolder ? "删除文件夹" : "删除",
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => onDeleteNode(node),
      },
    ],
    [isFolder, createItems, node, onDeleteNode, onFavoriteDoc, onStartRename],
  );

  const handleClick = () => {
    if (isFolder) {
      // Folder: both expand/collapse the tree and select so the right pane
      // shows the folder's content via DocBrowserView.
      onToggleExpand(node.relPath);
      onSelectNode(node);
      return;
    }
    if (hasChildren) {
      onToggleExpand(node.relPath);
      return;
    }
    onSelectNode(node);
  };

  // ── Drag & drop ────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent) => {
    if (isRenaming) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.setData(TREE_DRAG_MIME, node.relPath);
    e.dataTransfer.setData("text/plain", node.relPath);
    e.dataTransfer.effectAllowed = "move";
  };

  const isInternalDrag = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types).includes(TREE_DRAG_MIME);

  const handleDragOver = (e: React.DragEvent) => {
    if (!isFolder || !isInternalDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!isFolder || !isInternalDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isFolder) return;
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDropTarget(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isFolder) return;
    const src = e.dataTransfer.getData(TREE_DRAG_MIME);
    if (!src) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(false);
    if (src === node.relPath) return;
    // Prevent dropping a folder into itself or its own descendant
    if (node.relPath.startsWith(`${src}/`)) return;
    onMoveNode(src, node.relPath);
  };

  return (
    <Dropdown
      menu={{ items: contextMenuItems }}
      trigger={["contextMenu"]}
      placement="bottomLeft"
    >
      <div>
        {/* biome-ignore lint/a11y/useSemanticElements: the row contains toolbar buttons, so a native button would create invalid nested buttons. */}
        <div
          role="button"
          tabIndex={0}
          draggable={!isRenaming}
          data-draggable={!isRenaming || undefined}
          className={cn(
            "group w-full cursor-pointer items-center gap-1 rounded-md py-1 pr-2 text-left text-sm transition-colors",
            isDropTarget
              ? "bg-blue-500/10 ring-1 ring-blue-400 ring-inset"
              : isActive
                ? "bg-[var(--accent-subtle)] font-medium text-[var(--accent)]"
                : "text-fg-secondary hover:bg-fill-tertiary",
            "flex",
          )}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            handleClick();
          }}
          onMouseEnter={(e) => onNodeHover?.(e.currentTarget, node)}
          onMouseLeave={() => onNodeLeave?.()}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
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
          <span className="shrink-0 text-fg-muted">
            <NodeIcon node={node} isExpanded={isExpanded} />
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
                  return;
                }
                const trimmed = sanitizeNodeName(localName);
                if (trimmed && trimmed !== node.title)
                  onCommitRename(node.relPath, trimmed);
                else onCancelRename();
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
              className="min-w-0 flex-1 rounded border border-[var(--accent)] bg-surface-elevated px-1.5 py-0 text-sm outline-none"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate">
              {node.icon ? `${node.icon} ` : ""}
              {node.title || t(untitledI18nKey(node.type))}
            </span>
          )}
          {!isRenaming && (
            <div
              className="flex shrink-0 items-center gap-0.5"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="toolbar"
            >
              {isFolder && (
                <Dropdown
                  menu={{ items: createItems }}
                  trigger={["click"]}
                  placement="bottomRight"
                >
                  <button
                    type="button"
                    className="cursor-pointer rounded p-0.5 text-fg-muted opacity-0 transition-opacity hover:text-[var(--accent)] group-hover:opacity-100"
                    title={t("docs.newDocument")}
                  >
                    <Plus size={14} />
                  </button>
                </Dropdown>
              )}
              <button
                type="button"
                className={cn(
                  "cursor-pointer rounded p-0.5 transition-opacity",
                  node.isFavorite
                    ? "text-amber-500 opacity-100"
                    : "text-fg-muted opacity-0 hover:text-amber-500 group-hover:opacity-100",
                )}
                onClick={() => onFavoriteDoc(node.relPath)}
                title={node.isFavorite ? "取消收藏" : "收藏"}
              >
                <Heart
                  size={13}
                  fill={node.isFavorite ? "currentColor" : "none"}
                />
              </button>
            </div>
          )}
        </div>
      </div>
    </Dropdown>
  );
}

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
    // biome-ignore lint/a11y/useSemanticElements: the row contains toolbar buttons, so a native button would create invalid nested buttons.
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-2 rounded-md py-1 pr-2.5 pl-7 text-left text-sm transition-colors",
        isActive
          ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
          : "text-fg-secondary hover:bg-fill-tertiary",
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onClick();
      }}
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
