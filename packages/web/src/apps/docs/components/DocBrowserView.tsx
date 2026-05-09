/**
 * DocBrowserView — Finder-backed file browser for the doc app.
 */

import {
  type ContextMenuItem,
  cn,
  Empty,
  type FileNode,
  Spin,
  useContextMenu,
} from "@tokimo/ui";
import { ChevronRight, FileText, FolderPlus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { FinderFileGridView } from "@/apps/finder/components/FinderFileGrid";
import type { DocNode, DocNodeType } from "../lib/doc-node";
import { getAncestorChain } from "../lib/doc-node";

interface DocBrowserViewProps {
  nodes: DocNode[];
  allNodes: DocNode[];
  currentFolderId: string | null;
  onNavigateFolder: (folderId: string | null) => void;
  onOpenDoc: (docId: string, type: DocNodeType) => void;
  onCreateNode: (type: DocNodeType, parentId?: string) => void;
  onCreateFolder: (parentId?: string) => void;
  onDeleteNode: (id: string) => void;
  onUpdateNode: (id: string, title: string) => void;
  isLoading: boolean;
  viewMode: "all" | "favorites" | "archived";
}

function nodeToFileNode(node: DocNode): FileNode {
  return {
    name: node.title,
    path: node.relPath,
    isDirectory: node.type === "folder",
    modifiedAt: node.updatedAt,
    size: null,
  };
}

function getEmptyDescription(
  viewMode: DocBrowserViewProps["viewMode"],
): string {
  if (viewMode === "archived") return "回收站为空";
  if (viewMode === "favorites") return "暂无收藏文档";
  return "此文件夹为空";
}

export function DocBrowserView({
  nodes,
  allNodes,
  currentFolderId,
  onNavigateFolder,
  onOpenDoc,
  onCreateNode,
  onCreateFolder,
  onDeleteNode,
  onUpdateNode,
  isLoading,
  viewMode,
}: DocBrowserViewProps) {
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const { open, contextMenu } = useContextMenu();

  const breadcrumbPath = useMemo(() => {
    if (!currentFolderId) return [];
    return getAncestorChain(allNodes, currentFolderId);
  }, [allNodes, currentFolderId]);

  const nodeByPath = useMemo(
    () => new Map(nodes.map((node) => [node.relPath, node])),
    [nodes],
  );

  const fileNodes = useMemo(() => nodes.map(nodeToFileNode), [nodes]);

  const parentFolderId = breadcrumbPath.at(-1)?.parentId ?? null;

  const openNode = useCallback(
    (node: DocNode) => {
      if (node.type === "folder") {
        onNavigateFolder(node.relPath);
        return;
      }
      onOpenDoc(node.relPath, node.type);
    },
    [onNavigateFolder, onOpenDoc],
  );

  const handleItemClick = useCallback(
    (node: FileNode, event: React.MouseEvent) => {
      setSelectedPaths((prev) => {
        if (event.metaKey || event.ctrlKey) {
          const next = new Set(prev);
          next.has(node.path) ? next.delete(node.path) : next.add(node.path);
          return next;
        }
        return new Set([node.path]);
      });
    },
    [],
  );

  const handleItemDoubleClick = useCallback(
    (fileNode: FileNode) => {
      const node = nodeByPath.get(fileNode.path);
      if (node) openNode(node);
    },
    [nodeByPath, openNode],
  );

  const handleItemContextMenu = useCallback(
    (fileNode: FileNode, event: React.MouseEvent) => {
      const node = nodeByPath.get(fileNode.path);
      if (!node) return;
      setSelectedPaths(new Set([fileNode.path]));
      const items: ContextMenuItem[] = [
        { key: "open", label: "打开", onClick: () => openNode(node) },
        {
          key: "rename",
          label: "重命名",
          onClick: () => setRenaming(fileNode.path),
        },
        { type: "divider" },
        {
          key: "delete",
          label: viewMode === "archived" ? "删除" : "移到回收站",
          danger: true,
          onClick: () => {
            if (
              window.confirm(
                node.type === "folder" ? "确定删除此文件夹？" : "确定删除？",
              )
            ) {
              onDeleteNode(node.relPath);
            }
          },
        },
      ];
      open(event, items);
    },
    [nodeByPath, onDeleteNode, open, openNode, viewMode],
  );

  const handleEmptyContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (viewMode === "archived") return;
      const parentId = currentFolderId ?? undefined;
      open(event, [
        {
          key: "new-doc",
          label: "新建文档",
          onClick: () => onCreateNode("notion", parentId),
        },
        {
          key: "new-folder",
          label: "新建文件夹",
          onClick: () => onCreateFolder(parentId),
        },
      ]);
    },
    [currentFolderId, onCreateFolder, onCreateNode, open, viewMode],
  );

  const handleRenameSubmit = useCallback(
    (path: string, name: string) => {
      const trimmed = name.trim();
      if (trimmed) onUpdateNode(path, trimmed);
      setRenaming(null);
    },
    [onUpdateNode],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-1 border-b border-border-subtle px-4 py-2.5">
        <div className="flex flex-1 items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => onNavigateFolder(null)}
            className={cn(
              "cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-fill-tertiary",
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
                  "cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-fill-tertiary",
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
          {viewMode === "favorites" && (
            <>
              <ChevronRight size={14} className="text-fg-muted" />
              <span className="font-medium text-fg-primary">收藏</span>
            </>
          )}
          {viewMode === "archived" && (
            <>
              <ChevronRight size={14} className="text-fg-muted" />
              <span className="font-medium text-fg-primary">回收站</span>
            </>
          )}
        </div>
      </div>

      {viewMode !== "archived" && (
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2">
          <button
            type="button"
            onClick={() => onCreateNode("notion", currentFolderId ?? undefined)}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-subtle bg-fill-secondary px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:bg-fill-tertiary"
          >
            <FileText size={15} className="text-[var(--accent)]" />
            新建文档
          </button>
          {viewMode === "all" && (
            <button
              type="button"
              onClick={() => onCreateFolder(currentFolderId ?? undefined)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-subtle bg-fill-secondary px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:bg-fill-tertiary"
            >
              <FolderPlus size={15} className="text-[var(--accent)]" />
              新建文件夹
            </button>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spin />
          </div>
        ) : fileNodes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Empty
              className="text-[var(--text-quaternary)]"
              description={getEmptyDescription(viewMode)}
            />
          </div>
        ) : (
          <FinderFileGridView
            nodes={fileNodes}
            selectedPaths={selectedPaths}
            viewMode="list"
            renaming={renaming}
            currentPath={currentFolderId ?? "/"}
            onNavigateUp={
              currentFolderId
                ? () => onNavigateFolder(parentFolderId)
                : undefined
            }
            onItemClick={handleItemClick}
            onItemDoubleClick={handleItemDoubleClick}
            onItemContextMenu={handleItemContextMenu}
            onEmptyContextMenu={handleEmptyContextMenu}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={() => setRenaming(null)}
            onClearSelection={() => setSelectedPaths(new Set())}
            onSelectPaths={setSelectedPaths}
            onDragStart={(eventNode, _contextNodes, event) => {
              event.preventDefault();
              setSelectedPaths(new Set([eventNode.path]));
            }}
            onDragEnd={() => {}}
            onDropToFolder={(_targetNode, event) => event.preventDefault()}
            draggingPaths={new Set()}
          />
        )}
      </div>
      {contextMenu}
    </div>
  );
}
