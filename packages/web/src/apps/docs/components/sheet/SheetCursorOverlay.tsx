/**
 * SheetCursorOverlay — Renders remote collaborators' cell selections
 * as colored border overlays on top of the Univer spreadsheet canvas.
 *
 * Reads remote selection state from Yjs awareness (set by use-sheet-collab.ts)
 * and renders colored bordered rectangles positioned via DOM overlay.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { getAwareness } from "../collab/awareness-store";

// ── Types ───────────────────────────────────────────────────────────────────

interface CellRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

interface RemoteSelection {
  clientId: number;
  name: string;
  color: string;
  selections: CellRange[];
}

/** Minimal Univer Facade API surface for cell measurement. */
interface SheetAPI {
  getActiveWorkbook: () => {
    getActiveSheet: () => {
      getRowHeight: (row: number) => number;
      getColumnWidth: (col: number) => number;
    } | null;
  } | null;
}

// Fallback header sizes when canvas detection fails
const FALLBACK_ROW_HEADER_WIDTH = 46;

// ── Position computation ────────────────────────────────────────────────────

interface CellRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Compute the pixel rectangle for a cell range, relative to the canvas
 * origin (top-left of the grid area, after headers).
 */
function computeCellRect(
  range: CellRange,
  getRowHeight: (r: number) => number,
  getColWidth: (c: number) => number,
): CellRect {
  let top = 0;
  for (let r = 0; r < range.startRow; r++) top += getRowHeight(r);

  let left = 0;
  for (let c = 0; c < range.startColumn; c++) left += getColWidth(c);

  let height = 0;
  for (let r = range.startRow; r <= range.endRow; r++)
    height += getRowHeight(r);

  let width = 0;
  for (let c = range.startColumn; c <= range.endColumn; c++)
    width += getColWidth(c);

  return { top, left, width, height };
}

// ── Component ───────────────────────────────────────────────────────────────

interface SheetCursorOverlayProps {
  nodeId: string | null;
  univerAPI: SheetAPI | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Reads remote cell selections from awareness and renders colored borders
 * as a DOM overlay on top of the Univer canvas.
 */
export function SheetCursorOverlay({
  nodeId,
  univerAPI,
  containerRef,
}: SheetCursorOverlayProps) {
  const [remotes, setRemotes] = useState<RemoteSelection[]>([]);
  const [canvasOffset, setCanvasOffset] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh remote selection state from awareness
  const refreshRemotes = useCallback(() => {
    if (!nodeId) return;
    const awareness = getAwareness(nodeId);
    if (!awareness) return;

    const localId = awareness.clientID;
    const selections: RemoteSelection[] = [];

    for (const [clientId, state] of awareness.getStates()) {
      if (clientId === localId) continue;
      const user = state.user as { name?: string; color?: string } | undefined;
      const sel = state.selection as CellRange[] | undefined;
      if (!user?.name || !sel?.length) continue;

      selections.push({
        clientId,
        name: user.name,
        color: user.color ?? "#888",
        selections: sel,
      });
    }

    setRemotes(selections);
  }, [nodeId]);

  // Measure canvas position inside the container for overlay alignment.
  // Finds the main grid canvas (largest by area) and computes the row header
  // width from the column header canvas position.
  const measureCanvas = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvases = Array.from(container.querySelectorAll("canvas"));
    if (canvases.length === 0) return;

    // Find the main grid canvas (largest by area)
    let mainCanvas = canvases[0];
    let maxArea = mainCanvas.clientWidth * mainCanvas.clientHeight;
    for (let i = 1; i < canvases.length; i++) {
      const area = canvases[i].clientWidth * canvases[i].clientHeight;
      if (area > maxArea) {
        maxArea = area;
        mainCanvas = canvases[i];
      }
    }

    if (maxArea === 0) return;

    const containerRect = container.getBoundingClientRect();
    const mainRect = mainCanvas.getBoundingClientRect();

    // Find column header canvas: thin horizontal strip above the main canvas
    const colHeaderCanvas = canvases.find(
      (c) =>
        c !== mainCanvas &&
        c.clientWidth > 100 &&
        c.clientHeight > 0 &&
        c.clientHeight < 50,
    );

    // Row header width = distance from main canvas left to column header left
    const rowHeaderWidth = colHeaderCanvas
      ? colHeaderCanvas.getBoundingClientRect().left - mainRect.left
      : FALLBACK_ROW_HEADER_WIDTH;

    setCanvasOffset({
      top: mainRect.top - containerRect.top,
      left: mainRect.left - containerRect.left + rowHeaderWidth,
    });
  }, [containerRef]);

  // Subscribe to awareness changes
  useEffect(() => {
    if (!nodeId) return;

    const awareness = getAwareness(nodeId);
    if (!awareness) {
      // Awareness may not be registered yet — retry via store subscription
      const checkInterval = setInterval(() => {
        const a = getAwareness(nodeId);
        if (a) {
          clearInterval(checkInterval);
          refreshRemotes();
        }
      }, 500);
      return () => clearInterval(checkInterval);
    }

    const handler = () => refreshRemotes();
    awareness.on("change", handler);
    refreshRemotes();

    return () => {
      awareness.off("change", handler);
    };
  }, [nodeId, refreshRemotes]);

  // Periodically refresh canvas position and scroll offset
  useEffect(() => {
    measureCanvas();
    refreshTimerRef.current = setInterval(() => {
      measureCanvas();
      refreshRemotes();
    }, 300);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [measureCanvas, refreshRemotes]);

  if (!canvasOffset || remotes.length === 0 || !univerAPI) return null;

  const sheet = univerAPI.getActiveWorkbook?.()?.getActiveSheet?.();
  if (!sheet) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      style={{
        top: canvasOffset.top,
        left: canvasOffset.left,
      }}
    >
      {remotes.map((remote) =>
        remote.selections.map((sel) => {
          const rect = computeCellRect(
            sel,
            (r) => sheet.getRowHeight(r),
            (c) => sheet.getColumnWidth(c),
          );
          return (
            <div
              key={`${remote.clientId}-${sel.startRow}-${sel.startColumn}`}
              className="absolute"
              style={{
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                border: `2px solid ${remote.color}`,
                borderRadius: 1,
              }}
            >
              <div
                className="absolute -top-4 left-0 whitespace-nowrap rounded-t px-1 text-[10px] leading-tight text-white"
                style={{ backgroundColor: remote.color }}
              >
                {remote.name}
              </div>
            </div>
          );
        }),
      )}
    </div>
  );
}
