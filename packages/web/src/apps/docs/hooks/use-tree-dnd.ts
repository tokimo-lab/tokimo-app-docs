/**
 * useTreeDnd — Pointer-event-based drag-to-reorder hook for the doc tree.
 *
 * Inspired by the generic `useDnd` hook in @tokiomo/components but extended
 * for tree semantics: "before" / "inside" / "after" drop zones, auto-expand
 * on hover, and root-level drop detection.
 *
 * Visual feedback uses CSS `transform: translateY()` with eased transitions —
 * items smoothly shift to make room, exactly like the table DnD sort.
 */

import type { CSSProperties } from "react";
import { useRef, useState } from "react";
import type { DropPosition } from "../components/tree-drag-context";
import type { FlatTreeItem } from "../lib/doc-node";

// ── Types ───────────────────────────────────────────────────────────────────

interface UseTreeDndOptions {
  /** Ordered flat list of all visible tree nodes */
  flatItems: FlatTreeItem[];
  /** Return IDs that cannot be drop targets (dragged node + its descendants) */
  getInvalidIds: (dragId: string) => Set<string>;
  /** Called on successful drop */
  onDrop: (
    draggedId: string,
    targetId: string | null,
    position: DropPosition,
  ) => void;
  /** Called to expand a collapsed folder during hover */
  onExpandFolder: (folderId: string) => void;
  disabled?: boolean;
}

interface DragState {
  fromIndex: number;
  overIndex: number;
  mode: "reorder" | "inside" | "root";
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Minimum pointer movement (px) before drag starts */
const DRAG_THRESHOLD = 5;
/** How long to hover a collapsed folder before auto-expanding it (ms) */
const FOLDER_EXPAND_DELAY = 1000;

// ── Hook ────────────────────────────────────────────────────────────────────

export function useTreeDnd({
  flatItems,
  getInvalidIds,
  onDrop,
  onExpandFolder,
  disabled = false,
}: UseTreeDndOptions) {
  const [drag, setDrag] = useState<DragState | null>(null);

  // Refs keep latest values visible inside pointer-event closures
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const flatItemsRef = useRef(flatItems);
  flatItemsRef.current = flatItems;

  const containerRef = useRef<HTMLDivElement>(null);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragActiveRef = useRef(false);
  const suppressClickRef = useRef(false);
  const fromIndexRef = useRef(-1);
  const overIndexRef = useRef(-1);
  const modeRef = useRef<DragState["mode"]>("reorder");
  const slotHeightRef = useRef(0);
  const containerTopRef = useRef(0);
  const invalidIdsRef = useRef<Set<string>>(new Set());

  function clearExpandTimer() {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
  }

  /** Attach to each tree row's onPointerDown. */
  const handlePointerDown = (nodeId: string, e: React.PointerEvent) => {
    if (disabledRef.current || e.button !== 0) return;
    // Don't start drag from inputs (rename mode)
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    const items = flatItemsRef.current;
    const idx = items.findIndex((n) => n.node.id === nodeId);
    if (idx < 0) return;

    const startY = e.clientY;
    const startX = e.clientX;
    fromIndexRef.current = idx;
    overIndexRef.current = idx;
    dragActiveRef.current = false;
    invalidIdsRef.current = getInvalidIds(nodeId);

    // Measure slot height from actual DOM elements
    const container = containerRef.current;
    if (!container) return;
    const rows = container.querySelectorAll("[data-tree-dnd]");
    if (rows.length >= 2) {
      slotHeightRef.current =
        rows[1].getBoundingClientRect().top -
        rows[0].getBoundingClientRect().top;
    } else if (rows.length === 1) {
      slotHeightRef.current = rows[0].getBoundingClientRect().height;
    }
    containerTopRef.current =
      rows[0]?.getBoundingClientRect().top ??
      container.getBoundingClientRect().top;

    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY;
      const dx = ev.clientX - startX;

      if (!dragActiveRef.current) {
        if (Math.abs(dy) + Math.abs(dx) < DRAG_THRESHOLD) return;
        dragActiveRef.current = true;
        document.documentElement.dataset.treeDragging = "";
        document.body.style.userSelect = "none";
        setDrag({
          fromIndex: fromIndexRef.current,
          overIndex: fromIndexRef.current,
          mode: "reorder",
        });
      }

      const h = slotHeightRef.current;
      if (!h) return;
      const currentItems = flatItemsRef.current;
      const rawIdx = Math.floor((ev.clientY - containerTopRef.current) / h);

      // Below all items → root drop
      if (rawIdx >= currentItems.length) {
        overIndexRef.current = currentItems.length - 1;
        modeRef.current = "root";
        clearExpandTimer();
        setDrag({
          fromIndex: fromIndexRef.current,
          overIndex: currentItems.length - 1,
          mode: "root",
        });
        return;
      }

      const clampedIdx = Math.max(0, rawIdx);
      const target = currentItems[clampedIdx];
      const from = currentItems[fromIndexRef.current];
      if (!target || !from) return;

      // Back over own slot → reset to home position
      if (target.node.id === from.node.id) {
        overIndexRef.current = fromIndexRef.current;
        modeRef.current = "reorder";
        clearExpandTimer();
        setDrag({
          fromIndex: fromIndexRef.current,
          overIndex: fromIndexRef.current,
          mode: "reorder",
        });
        return;
      }

      if (invalidIdsRef.current.has(target.node.id)) {
        return; // descendant of dragged node — keep previous visual
      }

      // Determine drop mode from pointer Y within the row
      const rowTop = containerTopRef.current + clampedIdx * h;
      const relY = ev.clientY - rowTop;
      const ratio = relY / h;

      let mode: "reorder" | "inside" = "reorder";
      if (target.isFolder) {
        if (target.isExpanded && target.hasChildren) {
          // Expanded folder: top half = reorder, bottom half = inside
          mode = ratio >= 0.5 ? "inside" : "reorder";
        } else {
          // Collapsed/empty folder: 25% before / 50% inside / 25% after
          if (ratio >= 0.25 && ratio <= 0.75) mode = "inside";
        }
      }

      overIndexRef.current = clampedIdx;
      modeRef.current = mode;

      // Auto-expand collapsed folder after sustained hover
      if (mode === "inside" && target.isFolder && !target.isExpanded) {
        if (!expandTimerRef.current) {
          const tid = target.node.id;
          expandTimerRef.current = setTimeout(() => {
            onExpandFolder(tid);
            expandTimerRef.current = null;
          }, FOLDER_EXPAND_DELAY);
        }
      } else {
        clearExpandTimer();
      }

      setDrag({ fromIndex: fromIndexRef.current, overIndex: clampedIdx, mode });
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      delete document.documentElement.dataset.treeDragging;
      document.body.style.userSelect = "";
      clearExpandTimer();

      const wasDrag = dragActiveRef.current;
      const from = fromIndexRef.current;
      const over = overIndexRef.current;
      const mode = modeRef.current;

      fromIndexRef.current = -1;
      overIndexRef.current = -1;
      dragActiveRef.current = false;
      setDrag(null);

      if (!wasDrag) return; // was a click, not a drag

      // Suppress the click event that fires right after pointerup
      suppressClickRef.current = true;
      requestAnimationFrame(() => {
        suppressClickRef.current = false;
      });

      const currentItems = flatItemsRef.current;
      const draggedNode = currentItems[from]?.node;
      if (!draggedNode) return;

      if (mode === "root") {
        onDrop(draggedNode.id, null, "after");
        return;
      }

      const targetNode = currentItems[over]?.node;
      if (!targetNode || invalidIdsRef.current.has(targetNode.id)) return;
      if (from === over) return;

      if (mode === "inside") {
        onDrop(draggedNode.id, targetNode.id, "inside");
      } else {
        const position: DropPosition = from < over ? "after" : "before";
        onDrop(draggedNode.id, targetNode.id, position);
      }
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  // ── Style computation ─────────────────────────────────────────────────────

  const idToIndex = new Map<string, number>();
  for (let i = 0; i < flatItems.length; i++) {
    idToIndex.set(flatItems[i].node.id, i);
  }

  const getNodeStyle = (nodeId: string): CSSProperties => {
    if (!drag) return {};
    const idx = idToIndex.get(nodeId);
    if (idx === undefined) return {};

    const { fromIndex, overIndex, mode } = drag;
    const h = slotHeightRef.current || 28;
    const transition = "transform 200ms cubic-bezier(.2,0,0,1)";

    // "inside": no shifting — just dim the dragged item
    if (mode === "inside") {
      if (idx === fromIndex) {
        return { opacity: 0.5, transition: "opacity 150ms" };
      }
      return {};
    }

    // "root" mode: treat as reorder to virtual slot past the last item
    const effectiveOver = mode === "root" ? flatItems.length : overIndex;

    // Reorder mode (including root)
    if (fromIndex === effectiveOver) {
      if (idx === fromIndex) {
        return {
          transform: "translateY(0)",
          transition,
          opacity: 0.85,
          zIndex: 1,
          position: "relative",
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
        };
      }
      return { transform: "translateY(0)", transition };
    }

    // Dragged item: visually move to the target slot
    if (idx === fromIndex) {
      const targetSlot = mode === "root" ? flatItems.length - 1 : effectiveOver;
      return {
        transform: `translateY(${(targetSlot - fromIndex) * h}px)`,
        transition,
        opacity: 0.85,
        zIndex: 1,
        position: "relative",
        boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
      };
    }

    // Items between from/effectiveOver shift by one slot to make room
    if (fromIndex < effectiveOver && idx > fromIndex && idx <= effectiveOver) {
      return { transform: `translateY(-${h}px)`, transition };
    }
    if (fromIndex > effectiveOver && idx >= effectiveOver && idx < fromIndex) {
      return { transform: `translateY(${h}px)`, transition };
    }

    return { transform: "translateY(0)", transition };
  };

  const isInsideTarget = (nodeId: string): boolean => {
    if (!drag || drag.mode !== "inside") return false;
    return idToIndex.get(nodeId) === drag.overIndex;
  };

  return {
    containerRef,
    getNodeStyle,
    isInsideTarget,
    isDragging: drag !== null,
    draggedId: drag ? (flatItems[drag.fromIndex]?.node.id ?? null) : null,
    handlePointerDown,
    shouldSuppressClick: () => suppressClickRef.current,
  };
}
