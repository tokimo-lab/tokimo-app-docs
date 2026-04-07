/**
 * TreeDragContext — Shared drag state for the doc tree sidebar.
 *
 * Provides the currently-dragged node ID, its descendant IDs (for
 * preventing circular drops), and the current drop indicator position
 * to all tree items without prop drilling.
 */

import { createContext, useContext } from "react";
import type { DocTreeNode } from "../lib/doc-node";

// ── Types ───────────────────────────────────────────────────────────────────

export type DropPosition = "before" | "inside" | "after";

export interface DropIndicator {
  nodeId: string;
  position: DropPosition;
}

// ── Context ─────────────────────────────────────────────────────────────────

interface TreeDragState {
  dragNodeId: string | null;
  dragDescendantIds: Set<string>;
  dropIndicator: DropIndicator | null;
  startDrag: (nodeId: string) => void;
  endDrag: () => void;
  setDropIndicator: (indicator: DropIndicator | null) => void;
}

const EMPTY_SET = new Set<string>();
const NOOP = () => {};

export const TreeDragContext = createContext<TreeDragState>({
  dragNodeId: null,
  dragDescendantIds: EMPTY_SET,
  dropIndicator: null,
  startDrag: NOOP,
  endDrag: NOOP,
  setDropIndicator: NOOP,
});

export function useTreeDrag() {
  return useContext(TreeDragContext);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Collect all descendant IDs of a node in the tree (excludes the node itself). */
export function collectDescendantIds(
  treeNodes: DocTreeNode[],
  nodeId: string,
): Set<string> {
  const ids = new Set<string>();

  function findNode(nodes: DocTreeNode[]): DocTreeNode | undefined {
    for (const tn of nodes) {
      if (tn.node.id === nodeId) return tn;
      const found = findNode(tn.children);
      if (found) return found;
    }
    return undefined;
  }

  function collect(nodes: DocTreeNode[]) {
    for (const tn of nodes) {
      ids.add(tn.node.id);
      collect(tn.children);
    }
  }

  const found = findNode(treeNodes);
  if (found) collect(found.children);
  return ids;
}

/** Edge zone size in px for before/after detection. */
export const DROP_EDGE_PX = 8;
