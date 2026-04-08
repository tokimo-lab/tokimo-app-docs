import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocNodeListItem } from "@/generated/rust-api";
import { useTreeDnd } from "../hooks/use-tree-dnd";
import type { DocNode } from "../lib/doc-node";
import {
  apiNodeToLocal,
  buildNodeTree,
  collectDescendantIds,
  flattenVisibleTree,
} from "../lib/doc-node";
import type { DropPosition } from "./tree-drag-context";

interface UseDocSidebarNodesOptions {
  nodes: DocNodeListItem[];
  expandedFolders: Set<string>;
  toggleFolder: (folderId: string) => void;
  onMoveNode: (id: string, parentId: string | null, sortOrder?: number) => void;
}

export function useDocSidebarNodes({
  nodes,
  expandedFolders,
  toggleFolder,
  onMoveNode,
}: UseDocSidebarNodesOptions) {
  // ── Optimistic override ──────────────────────────────────────
  const [optimisticNodes, setOptimisticNodes] = useState<DocNode[] | null>(
    null,
  );
  const nodesVersionRef = useRef(nodes);
  useEffect(() => {
    if (nodesVersionRef.current !== nodes) {
      nodesVersionRef.current = nodes;
      setOptimisticNodes(null);
    }
  }, [nodes]);

  const localNodes = useMemo(
    () => optimisticNodes ?? nodes.map(apiNodeToLocal),
    [optimisticNodes, nodes],
  );
  const treeNodes = useMemo(() => buildNodeTree(localNodes), [localNodes]);
  const flatDocNodes = localNodes;
  const allFolders = useMemo(
    () => localNodes.filter((n) => n.type === "folder"),
    [localNodes],
  );

  // ── DnD ──────────────────────────────────────────────────────
  const flatItems = useMemo(
    () => flattenVisibleTree(treeNodes, expandedFolders),
    [treeNodes, expandedFolders],
  );

  const getInvalidIds = useCallback(
    (dragId: string) => {
      const ids = collectDescendantIds(treeNodes, dragId);
      ids.add(dragId);
      return ids;
    },
    [treeNodes],
  );

  const resolveDropTarget = useCallback(
    (
      targetNodeId: string,
      position: DropPosition,
      excludeId?: string,
    ): { parentId: string | null; sortOrder: number } => {
      const targetNode = localNodes.find((n) => n.id === targetNodeId);
      if (!targetNode) return { parentId: null, sortOrder: 0 };

      if (position === "inside") {
        return { parentId: targetNodeId, sortOrder: 0 };
      }

      const siblingParentId = targetNode.parentId;
      const siblings = localNodes
        .filter((n) => n.parentId === siblingParentId && n.id !== excludeId)
        .sort((a, b) =>
          a.sortOrder !== b.sortOrder
            ? a.sortOrder - b.sortOrder
            : a.title.localeCompare(b.title),
        );
      const idx = siblings.findIndex((n) => n.id === targetNodeId);

      if (position === "before") {
        return {
          parentId: siblingParentId,
          sortOrder: idx >= 0 ? siblings[idx].sortOrder : 0,
        };
      }
      return {
        parentId: siblingParentId,
        sortOrder: idx >= 0 ? siblings[idx].sortOrder + 1 : siblings.length,
      };
    },
    [localNodes],
  );

  const applyOptimistic = useCallback(
    (docId: string, parentId: string | null, sortOrder: number | undefined) => {
      const base = localNodes.map((n) =>
        n.id === docId
          ? { ...n, parentId, sortOrder: sortOrder ?? n.sortOrder }
          : n,
      );
      setOptimisticNodes(base);
    },
    [localNodes],
  );

  const handleMoveDoc = useCallback(
    (docId: string, targetId: string | null, position?: DropPosition) => {
      const draggedNode = localNodes.find((n) => n.id === docId);
      if (targetId && position && position !== "inside") {
        const { parentId, sortOrder } = resolveDropTarget(
          targetId,
          position,
          docId,
        );
        if (
          draggedNode &&
          draggedNode.parentId === parentId &&
          draggedNode.sortOrder === sortOrder
        )
          return;
        applyOptimistic(docId, parentId, sortOrder);
        onMoveNode(docId, parentId, sortOrder);
      } else if (targetId === null && position === "after") {
        if (draggedNode && draggedNode.parentId === null) return;
        const rootSiblings = localNodes.filter(
          (n) => n.parentId === null && n.id !== docId,
        );
        const maxOrder = rootSiblings.reduce(
          (max, n) => Math.max(max, n.sortOrder),
          -1,
        );
        applyOptimistic(docId, null, maxOrder + 1);
        onMoveNode(docId, null, maxOrder + 1);
      } else {
        if (draggedNode && draggedNode.parentId === targetId) return;
        applyOptimistic(docId, targetId ?? null, undefined);
        onMoveNode(docId, targetId);
      }
    },
    [onMoveNode, resolveDropTarget, localNodes, applyOptimistic],
  );

  const dnd = useTreeDnd({
    flatItems,
    getInvalidIds,
    onDrop: handleMoveDoc,
    onExpandFolder: toggleFolder,
  });

  const treeDragValue = useMemo(
    () => ({
      isDragging: dnd.isDragging,
      draggedId: dnd.draggedId,
      getNodeStyle: dnd.getNodeStyle,
      isInsideTarget: dnd.isInsideTarget,
      handlePointerDown: dnd.handlePointerDown,
      shouldSuppressClick: dnd.shouldSuppressClick,
    }),
    [dnd],
  );

  return {
    flatDocNodes,
    allFolders,
    flatItems,
    handleMoveDoc,
    treeDragValue,
    dnd,
  };
}
