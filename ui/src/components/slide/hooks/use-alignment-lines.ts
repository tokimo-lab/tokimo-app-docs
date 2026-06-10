import { useCallback, useRef, useState } from "react";
import type { SlideElement } from "../types";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "../types";

export interface AlignmentLine {
  type: "horizontal" | "vertical";
  position: number;
}

const SNAP_THRESHOLD = 5;

function getElementEdges(el: SlideElement) {
  const left = el.left;
  const w = el.width;
  const right = left + w;
  // SlideLineElement omits height — fallback to 0
  const h = "height" in el ? (el.height as number) : 0;
  const top = el.top;
  const bottom = top + h;
  const centerX = left + w / 2;
  const centerY = top + h / 2;
  return { left, right, top, bottom, centerX, centerY };
}

export function useAlignmentLines() {
  const [lines, setLines] = useState<AlignmentLine[]>([]);
  const linesRef = useRef<AlignmentLine[]>([]);

  const computeLines = useCallback(
    (
      draggedElement: {
        left: number;
        top: number;
        width: number;
        height: number;
      },
      otherElements: SlideElement[],
    ): { snapX: number | null; snapY: number | null } => {
      const newLines: AlignmentLine[] = [];
      let snapX: number | null = null;
      let snapY: number | null = null;

      const dragEdges = {
        left: draggedElement.left,
        right: draggedElement.left + draggedElement.width,
        top: draggedElement.top,
        bottom: draggedElement.top + draggedElement.height,
        centerX: draggedElement.left + draggedElement.width / 2,
        centerY: draggedElement.top + draggedElement.height / 2,
      };

      // Canvas center lines
      const canvasCenterX = VIEWPORT_WIDTH / 2;
      const canvasCenterY = VIEWPORT_HEIGHT / 2;

      // Check vertical lines (x positions)
      const vTargets: Array<{ pos: number; source: string }> = [
        { pos: canvasCenterX, source: "canvas" },
        { pos: 0, source: "canvas-edge" },
        { pos: VIEWPORT_WIDTH, source: "canvas-edge" },
      ];
      // Check horizontal lines (y positions)
      const hTargets: Array<{ pos: number; source: string }> = [
        { pos: canvasCenterY, source: "canvas" },
        { pos: 0, source: "canvas-edge" },
        { pos: VIEWPORT_HEIGHT, source: "canvas-edge" },
      ];

      for (const el of otherElements) {
        const edges = getElementEdges(el);
        vTargets.push(
          { pos: edges.left, source: el.id },
          { pos: edges.right, source: el.id },
          { pos: edges.centerX, source: el.id },
        );
        hTargets.push(
          { pos: edges.top, source: el.id },
          { pos: edges.bottom, source: el.id },
          { pos: edges.centerY, source: el.id },
        );
      }

      // Check vertical alignment (x)
      const dragXPoints = [dragEdges.left, dragEdges.right, dragEdges.centerX];
      let bestVDist = SNAP_THRESHOLD + 1;
      for (const dragX of dragXPoints) {
        for (const target of vTargets) {
          const dist = Math.abs(dragX - target.pos);
          if (dist < bestVDist) {
            bestVDist = dist;
            snapX = target.pos - (dragX - draggedElement.left);
          }
          if (dist <= SNAP_THRESHOLD) {
            newLines.push({ type: "vertical", position: target.pos });
          }
        }
      }

      // Check horizontal alignment (y)
      const dragYPoints = [dragEdges.top, dragEdges.bottom, dragEdges.centerY];
      let bestHDist = SNAP_THRESHOLD + 1;
      for (const dragY of dragYPoints) {
        for (const target of hTargets) {
          const dist = Math.abs(dragY - target.pos);
          if (dist < bestHDist) {
            bestHDist = dist;
            snapY = target.pos - (dragY - draggedElement.top);
          }
          if (dist <= SNAP_THRESHOLD) {
            newLines.push({ type: "horizontal", position: target.pos });
          }
        }
      }

      if (bestVDist > SNAP_THRESHOLD) snapX = null;
      if (bestHDist > SNAP_THRESHOLD) snapY = null;

      // Deduplicate
      const unique = newLines.filter(
        (line, idx, arr) =>
          arr.findIndex(
            (l) => l.type === line.type && l.position === line.position,
          ) === idx,
      );

      linesRef.current = unique;
      setLines(unique);

      return { snapX, snapY };
    },
    [],
  );

  const clearLines = useCallback(() => {
    linesRef.current = [];
    setLines([]);
  }, []);

  return { lines, computeLines, clearLines };
}
