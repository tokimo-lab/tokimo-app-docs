/**
 * TreeDragContext — Carries the useTreeDnd hook results to all tree rows.
 *
 * The actual DnD logic lives in `hooks/use-tree-dnd.ts`.  This context
 * simply makes the hook's return values available to NodeTreeItem without
 * prop drilling.
 */

import type { CSSProperties } from "react";
import { createContext, useContext } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

export type DropPosition = "before" | "inside" | "after";

interface TreeDragState {
  isDragging: boolean;
  draggedId: string | null;
  isRootDrop: boolean;
  getNodeStyle: (nodeId: string) => CSSProperties;
  isInsideTarget: (nodeId: string) => boolean;
  handlePointerDown: (nodeId: string, e: React.PointerEvent) => void;
  shouldSuppressClick: () => boolean;
}

// ── Defaults (no-op when outside provider) ──────────────────────────────────

const EMPTY_STYLE: CSSProperties = {};
const NOOP_STYLE = () => EMPTY_STYLE;
const FALSE = () => false;

export const TreeDragContext = createContext<TreeDragState>({
  isDragging: false,
  draggedId: null,
  isRootDrop: false,
  getNodeStyle: NOOP_STYLE,
  isInsideTarget: FALSE,
  handlePointerDown: () => {},
  shouldSuppressClick: FALSE,
});

export function useTreeDrag() {
  return useContext(TreeDragContext);
}
