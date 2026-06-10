import {
  CursorEditor,
  type CursorState,
  type RemoteCursorChangeEventListener,
} from "@slate-yjs/core";
import { getCursorRange } from "@slate-yjs/react";
import { useEditorRef } from "platejs/react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface CursorData {
  name: string;
  color: string;
}

interface SelectionRect {
  width: number;
  height: number;
  top: number;
  left: number;
}

interface CaretPosition {
  height: number;
  top: number;
  left: number;
}

interface OverlayData {
  clientId: number;
  data?: CursorData;
  displayName: string;
  caretPosition: CaretPosition | null;
  selectionRects: SelectionRect[];
}

/** Compute overlay rects for a given Slate range relative to a container element. */
function computeOverlayPosition(
  editor: ReturnType<typeof useEditorRef>,
  range: unknown,
  containerRect: DOMRect,
): { caretPosition: CaretPosition | null; selectionRects: SelectionRect[] } {
  try {
    // Plate editor exposes toDOMRange on editor.api
    const domRange = editor.api.toDOMRange(
      range as Parameters<typeof editor.api.toDOMRange>[0],
    );
    if (!domRange) return { caretPosition: null, selectionRects: [] };

    const rects = domRange.getClientRects();
    if (rects.length === 0) return { caretPosition: null, selectionRects: [] };

    const selectionRects: SelectionRect[] = [];
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      selectionRects.push({
        width: rect.width,
        height: rect.height,
        top: rect.top - containerRect.top,
        left: rect.left - containerRect.left,
      });
    }

    // Caret is the last rect's right edge (or first rect's left edge for collapsed)
    const lastRect = rects[rects.length - 1];
    const caretPosition: CaretPosition = {
      height: lastRect.height,
      top: lastRect.top - containerRect.top,
      left: lastRect.right - containerRect.left,
    };

    return { caretPosition, selectionRects };
  } catch {
    return { caretPosition: null, selectionRects: [] };
  }
}

/**
 * Compute display names with #N suffix when multiple connections share the
 * same user name. Numbering is based on sorted clientIds across ALL
 * connections (local + remote) so every tab sees a consistent order.
 */
function buildDisplayNames(
  remoteCursors: Array<{ clientId: number; name: string }>,
  localClientId: number | null,
  localUserName: string | undefined,
): Map<number, string> {
  const result = new Map<number, string>();

  // Collect all clients (local + remote) sharing a name
  const allClients: Array<{ clientId: number; name: string }> = [];
  if (localClientId != null && localUserName) {
    allClients.push({ clientId: localClientId, name: localUserName });
  }
  for (const c of remoteCursors) {
    allClients.push(c);
  }

  // Group by name
  const groups = new Map<string, number[]>();
  for (const { clientId, name } of allClients) {
    const arr = groups.get(name) ?? [];
    arr.push(clientId);
    groups.set(name, arr);
  }

  // Sort each group by clientId for stable ordering
  for (const ids of groups.values()) {
    ids.sort((a, b) => a - b);
  }

  // Assign display names
  for (const c of remoteCursors) {
    const group = groups.get(c.name);
    if (group && group.length > 1) {
      const idx = group.indexOf(c.clientId);
      result.set(c.clientId, `${c.name} #${idx + 1}`);
    } else {
      result.set(c.clientId, c.name);
    }
  }

  return result;
}

/** Renders remote collaborators' cursors and selections as an overlay on top of the editor. */
export function RemoteCursorOverlay({
  children,
  localUserName,
}: {
  children: ReactNode;
  localUserName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editor = useEditorRef();
  const [overlays, setOverlays] = useState<OverlayData[]>([]);

  const refresh = useCallback(() => {
    if (!CursorEditor.isCursorEditor(editor)) return;
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const states = CursorEditor.cursorStates(editor);

    // Get local clientId from the awareness instance on the CursorEditor
    const localClientId =
      (editor as unknown as { awareness?: { clientID: number } }).awareness
        ?.clientID ?? null;

    // Collect remote cursor info for display name computation.
    // NOTE: CursorEditor.cursorStates() returns entries keyed by awareness
    // clientId (as string). The state objects do NOT have a clientId property,
    // so we must use the key.
    const remoteCursors: Array<{ clientId: number; name: string }> = [];
    const stateEntries: Array<[number, CursorState<Record<string, unknown>>]> =
      [];
    for (const [key, state] of Object.entries(states)) {
      const clientId = Number(key);
      const cursorData = state.data as CursorData | undefined;
      const name = cursorData?.name ?? "Anonymous";
      remoteCursors.push({ clientId, name });
      stateEntries.push([clientId, state]);
    }

    const displayNames = buildDisplayNames(
      remoteCursors,
      localClientId,
      localUserName,
    );

    const items: OverlayData[] = [];
    for (const [clientId, state] of stateEntries) {
      const cursorData = state.data as CursorData | undefined;
      const range = getCursorRange(
        editor as Parameters<typeof getCursorRange>[0],
        state as Parameters<typeof getCursorRange>[1],
      );

      // Skip cursors with no range and no data (stale/disconnected entries)
      if (!range && !cursorData) continue;

      if (!range) {
        items.push({
          clientId,
          data: cursorData,
          displayName: displayNames.get(clientId) ?? "Anonymous",
          caretPosition: null,
          selectionRects: [],
        });
        continue;
      }

      const { caretPosition, selectionRects } = computeOverlayPosition(
        editor,
        range,
        containerRect,
      );
      items.push({
        clientId,
        data: cursorData,
        displayName: displayNames.get(clientId) ?? "Anonymous",
        caretPosition,
        selectionRects,
      });
    }

    setOverlays(items);
  }, [editor, localUserName]);

  // Subscribe to cursor state changes
  useEffect(() => {
    if (!CursorEditor.isCursorEditor(editor)) return;

    const handler: RemoteCursorChangeEventListener = (event) => {
      // If cursors were removed, refresh immediately to clear stale overlays
      if (event.removed.length > 0) {
        refresh();
        return;
      }
      // Use requestAnimationFrame so DOM is up to date for position measurement
      requestAnimationFrame(refresh);
    };
    CursorEditor.on(editor, "change", handler);

    // Also refresh on editor content changes (scroll, resize, edits)
    const container = containerRef.current;
    const observer = container
      ? new MutationObserver(() => requestAnimationFrame(refresh))
      : null;
    if (container && observer) {
      observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    return () => {
      if (CursorEditor.isCursorEditor(editor)) {
        CursorEditor.off(editor, "change", handler);
      }
      observer?.disconnect();
    };
  }, [editor, refresh]);

  return (
    <div ref={containerRef} className="relative">
      {children}
      {overlays.map((cursor) => (
        <CursorOverlayRenderer key={cursor.clientId} cursor={cursor} />
      ))}
    </div>
  );
}

function CursorOverlayRenderer({ cursor }: { cursor: OverlayData }) {
  const { caretPosition, selectionRects, data, displayName } = cursor;
  const color = data?.color ?? "hsl(200, 70%, 55%)";

  return (
    <div className="pointer-events-none absolute inset-0">
      {selectionRects.map((rect) => (
        <div
          key={`${cursor.clientId}-${rect.left.toFixed(1)}-${rect.top.toFixed(1)}-${rect.width.toFixed(1)}-${rect.height.toFixed(1)}`}
          className="absolute"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            backgroundColor: color,
            opacity: 0.25,
          }}
        />
      ))}
      {caretPosition && (
        <div
          className="absolute z-10"
          style={{
            top: caretPosition.top,
            left: caretPosition.left,
            height: caretPosition.height,
          }}
        >
          <div
            className="w-0.5"
            style={{ backgroundColor: color, height: "100%" }}
          />
          <div
            className="absolute left-0 top-0 -translate-y-full whitespace-nowrap rounded-t px-1 py-0.5 text-[10px] leading-tight text-white"
            style={{ backgroundColor: color }}
          >
            {displayName}
          </div>
        </div>
      )}
    </div>
  );
}
