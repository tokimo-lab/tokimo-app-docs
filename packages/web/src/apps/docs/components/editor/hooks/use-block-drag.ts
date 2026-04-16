import { useEditorRef, useElement } from "platejs/react";
import type { RefObject } from "react";
import { useCallback, useRef, useState } from "react";

const DRAG_THRESHOLD = 5;

/** Snapshot bounding rects of all direct children of the editor. */
function snapshotEditorPositions(editorEl: Element): Map<Element, DOMRect> {
  const map = new Map<Element, DOMRect>();
  for (const child of editorEl.children) {
    map.set(child, child.getBoundingClientRect());
  }
  return map;
}

/** FLIP-animate children that shifted between two snapshots. */
function flipAnimateEditor(
  editorEl: Element,
  before: Map<Element, DOMRect>,
  skipEl?: Element,
): void {
  for (const child of editorEl.children) {
    if (child === skipEl) continue;
    const oldRect = before.get(child);
    if (!oldRect) continue;
    const newRect = child.getBoundingClientRect();
    const dy = oldRect.top - newRect.top;
    if (Math.abs(dy) < 1) continue;
    const el = child as HTMLElement;
    el.style.transition = "none";
    el.style.transform = `translateY(${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = "transform 200ms ease";
      el.style.transform = "";
      const cleanup = () => {
        el.style.transition = "";
        el.style.transform = "";
        el.removeEventListener("transitionend", cleanup);
      };
      el.addEventListener("transitionend", cleanup, { once: true });
    });
  }
}

/**
 * Find the target "slot" index for a drag at clientY.
 * Skips the dragged element in midpoint calculations to avoid oscillation.
 */
function findBlockTargetIndex(
  clientY: number,
  editorEl: Element,
  draggedEl: HTMLElement,
): number {
  const blocks = editorEl.querySelectorAll(
    ":scope > [data-slate-node='element']",
  );
  const others: { el: Element; fullIdx: number }[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i] !== draggedEl) others.push({ el: blocks[i], fullIdx: i });
  }
  if (others.length === 0) return 0;

  for (let i = 0; i < others.length; i++) {
    const rect = others[i].el.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (clientY < mid) {
      return others[i].fullIdx;
    }
  }
  return others[others.length - 1].fullIdx + 1;
}

/** Move a Slate block element to a target index among its siblings, with FLIP. */
function moveSlateBlockTo(
  slateBlock: HTMLElement,
  targetIndex: number,
  editorEl: Element,
): void {
  const blocks = editorEl.querySelectorAll(
    ":scope > [data-slate-node='element']",
  );
  let currentIndex = -1;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i] === slateBlock) {
      currentIndex = i;
      break;
    }
  }
  if (currentIndex === -1 || currentIndex === targetIndex) return;

  const before = snapshotEditorPositions(editorEl);

  if (targetIndex < blocks.length) {
    const refEl = blocks[targetIndex];
    if (refEl === slateBlock) return;
    editorEl.insertBefore(slateBlock, refEl);
  } else {
    editorEl.appendChild(slateBlock);
  }

  flipAnimateEditor(editorEl, before, slateBlock);
}

/** Get the current DOM index of a Slate block among its siblings. */
function getSlateBlockDomIndex(slateBlock: HTMLElement): number {
  const editorEl = slateBlock.parentElement;
  if (!editorEl) return -1;
  const blocks = editorEl.querySelectorAll(
    ":scope > [data-slate-node='element']",
  );
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i] === slateBlock) return i;
  }
  return -1;
}

interface DragState {
  startX: number;
  startY: number;
  active: boolean;
  ghost: HTMLElement | null;
  slateBlock: HTMLElement | null;
  offsetX: number;
  offsetY: number;
  fromIndex: number;
}

export function useBlockDrag(containerRef: RefObject<HTMLElement | null>): {
  isDragging: boolean;
  handleDragPointerDown: (e: React.PointerEvent) => void;
} {
  const editor = useEditorRef();
  const element = useElement();
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);

  const handleDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("button, a, input, select, textarea")) return;
      e.preventDefault();
      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        ghost: null,
        slateBlock: null,
        offsetX: 0,
        offsetY: 0,
        fromIndex: -1,
      };

      const onMove = (ev: PointerEvent) => {
        const ds = dragStateRef.current;
        if (!ds) return;

        if (!ds.active) {
          const dx = ev.clientX - ds.startX;
          const dy = ev.clientY - ds.startY;
          if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;

          ds.active = true;
          setIsDragging(true);

          const container = containerRef.current;
          if (!container) return;

          const slateBlock = container.closest(
            "[data-slate-node='element']",
          ) as HTMLElement | null;
          if (!slateBlock) return;
          ds.slateBlock = slateBlock;
          ds.fromIndex = getSlateBlockDomIndex(slateBlock);

          const rect = slateBlock.getBoundingClientRect();
          ds.offsetX = ds.startX - rect.left;
          ds.offsetY = ds.startY - rect.top;

          const ghost = slateBlock.cloneNode(true) as HTMLElement;
          ghost.id = "block-drag-ghost";
          ghost.style.cssText = `
            position: fixed; z-index: 9999; pointer-events: none;
            width: ${rect.width}px; opacity: 0.85;
            box-shadow: 0 8px 32px rgba(0,0,0,0.18);
            transform: scale(1.02); transition: opacity 150ms;
          `;
          ghost.style.left = `${ev.clientX - ds.offsetX}px`;
          ghost.style.top = `${ev.clientY - ds.offsetY}px`;
          document.body.appendChild(ghost);
          ds.ghost = ghost;
        }

        if (ds.active && ds.ghost && ds.slateBlock) {
          ds.ghost.style.left = `${ev.clientX - ds.offsetX}px`;
          ds.ghost.style.top = `${ev.clientY - ds.offsetY}px`;

          const editorEl = ds.slateBlock.parentElement;
          if (editorEl) {
            const targetIdx = findBlockTargetIndex(
              ev.clientY,
              editorEl,
              ds.slateBlock,
            );
            moveSlateBlockTo(ds.slateBlock, targetIdx, editorEl);
          }
        }
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        const ds = dragStateRef.current;
        dragStateRef.current = null;

        if (!ds?.active) {
          setIsDragging(false);
          return;
        }

        const newDomIndex = ds.slateBlock
          ? getSlateBlockDomIndex(ds.slateBlock)
          : -1;

        ds.ghost?.remove();
        setIsDragging(false);

        if (newDomIndex >= 0 && ds.fromIndex >= 0) {
          const fromPath = editor.api.findPath(element);
          if (fromPath) {
            const fromIndex = fromPath[0];
            if (fromIndex !== newDomIndex) {
              editor.tf.moveNodes({
                at: fromPath,
                to: [newDomIndex],
              });
            }
          }
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [editor, element, containerRef],
  );

  return { isDragging, handleDragPointerDown };
}
