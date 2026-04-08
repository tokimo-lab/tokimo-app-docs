/**
 * SheetCursorOverlay — Renders remote collaborators' cell selections
 * as colored border overlays on top of the Univer spreadsheet canvas.
 *
 * Uses the Univer skeleton API for precise cell positioning and accounts
 * for the current scroll state so overlays track correctly as the user scrolls.
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

interface CellRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// biome-ignore lint/suspicious/noExplicitAny: Univer facade types are extended via mixins; typed access is impractical
type UniverAPI = any;

// ── Position computation ────────────────────────────────────────────────────

/**
 * Compute the visible pixel rectangle for a cell range relative to the
 * grid viewport (after headers, accounting for scroll).
 *
 * Uses skeleton.getCellWithCoordByIndex for absolute positions, then
 * subtracts scroll pixel offset computed from rowHeightAccumulation /
 * columnWidthAccumulation + getScrollState.
 */
function computeVisibleCellRect(
  range: CellRange,
  skeleton: {
    rowHeightAccumulation: number[];
    columnWidthAccumulation: number[];
    rowHeaderWidth: number;
    columnHeaderHeight: number;
    getCellWithCoordByIndex: (
      row: number,
      col: number,
    ) => { startX: number; startY: number; endX: number; endY: number };
  },
  scrollState: {
    sheetViewStartRow: number;
    sheetViewStartColumn: number;
    offsetX: number;
    offsetY: number;
  },
): CellRect | null {
  const rowAcc = skeleton.rowHeightAccumulation;
  const colAcc = skeleton.columnWidthAccumulation;
  if (!rowAcc.length || !colAcc.length) return null;

  const startCell = skeleton.getCellWithCoordByIndex(
    range.startRow,
    range.startColumn,
  );
  const endCell = skeleton.getCellWithCoordByIndex(
    range.endRow,
    range.endColumn,
  );

  // getCellWithCoordByIndex returns absolute coords including headers.
  // Subtract headers so coords are relative to the grid-only overlay area.
  const headerW = skeleton.rowHeaderWidth ?? 0;
  const headerH = skeleton.columnHeaderHeight ?? 0;

  // Scroll offset in pixels
  const { sheetViewStartRow, sheetViewStartColumn, offsetX, offsetY } =
    scrollState;
  const scrollY =
    (sheetViewStartRow > 0 ? rowAcc[sheetViewStartRow - 1] : 0) + offsetY;
  const scrollX =
    (sheetViewStartColumn > 0 ? colAcc[sheetViewStartColumn - 1] : 0) + offsetX;

  return {
    top: startCell.startY - headerH - scrollY,
    left: startCell.startX - headerW - scrollX,
    width: endCell.endX - startCell.startX,
    height: endCell.endY - startCell.startY,
  };
}

// ── Component ───────────────────────────────────────────────────────────────

interface SheetCursorOverlayProps {
  nodeId: string | null;
  univerAPI: UniverAPI | null;
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
  const [gridOffset, setGridOffset] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRemotes = remotes.length > 0;

  // Force re-render when scroll state changes
  const [, forceRender] = useState(0);

  // Subscribe to Univer scroll events for instant overlay tracking
  useEffect(() => {
    if (!univerAPI || !hasRemotes) return;
    try {
      const sheet = univerAPI.getActiveWorkbook?.()?.getActiveSheet?.();
      if (!sheet?.onScroll) return;
      const disposable = sheet.onScroll(() =>
        forceRender((n: number) => n + 1),
      );
      return () => disposable?.dispose?.();
    } catch {
      // Univer DI may not be ready
    }
  }, [univerAPI, hasRemotes]);

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

  // Measure the grid-only viewport (excluding row/column headers).
  const measureGrid = useCallback(() => {
    const container = containerRef.current;
    if (!container || !univerAPI) return;

    let headerWidth = 0;
    let headerHeight = 0;
    try {
      const sheet = univerAPI.getActiveWorkbook?.()?.getActiveSheet?.();
      const sk = sheet?.getSkeleton?.();
      if (sk) {
        headerWidth = sk.rowHeaderWidth ?? 0;
        headerHeight = sk.columnHeaderHeight ?? 0;
      }
    } catch {
      // Univer DI may not be ready
    }

    // Find the largest canvas (Univer's main render canvas)
    const canvases = Array.from(container.querySelectorAll("canvas"));
    if (canvases.length === 0) return;

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
    const canvasRect = mainCanvas.getBoundingClientRect();

    // Clip overlay to the grid area only (after headers) so cursor
    // boxes can't bleed into the ABCD / 1234 header zone.
    setGridOffset({
      top: canvasRect.top - containerRect.top + headerHeight,
      left: canvasRect.left - containerRect.left + headerWidth,
      width: canvasRect.width - headerWidth,
      height: canvasRect.height - headerHeight,
    });
  }, [containerRef, univerAPI]);

  // Subscribe to awareness changes
  useEffect(() => {
    if (!nodeId) return;

    const awareness = getAwareness(nodeId);
    if (!awareness) {
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

  // Fallback timer for grid measurement and missed awareness updates
  useEffect(() => {
    measureGrid();
    refreshTimerRef.current = setInterval(() => {
      measureGrid();
      refreshRemotes();
    }, 1000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [measureGrid, refreshRemotes]);

  if (!gridOffset || remotes.length === 0 || !univerAPI) return null;

  let skeleton: ReturnType<typeof Object> | null = null;
  let scrollState: ReturnType<typeof Object> | null = null;
  try {
    const sheet = univerAPI.getActiveWorkbook?.()?.getActiveSheet?.();
    skeleton = sheet?.getSkeleton?.() ?? null;
    scrollState = sheet?.getScrollState?.() ?? null;
  } catch {
    // Univer DI may not be ready yet
  }
  if (!skeleton || !scrollState) return null;

  return (
    <div
      className="pointer-events-none absolute z-10 overflow-hidden"
      style={{
        top: gridOffset.top,
        left: gridOffset.left,
        width: gridOffset.width,
        height: gridOffset.height,
      }}
    >
      {remotes.map((remote) =>
        remote.selections.map((sel) => {
          const rect = computeVisibleCellRect(sel, skeleton, scrollState);
          if (!rect) return null;

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
