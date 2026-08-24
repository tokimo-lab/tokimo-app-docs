/**
 * useSheetCollab — Yjs-based real-time collaboration for Univer spreadsheet.
 *
 * Uses mutation forwarding: local mutations are captured via ICommandService's
 * onMutationExecutedForCollab and appended to a Y.Array. Remote mutations are
 * replayed via syncExecuteCommand({ fromCollab: true }).
 *
 * Y.Doc structure:
 *   Y.Map("sheet")       → "snapshot": initial workbook JSON (set once on room creation)
 *   Y.Array("sheet-ops") → [{ id, params, clientId }, ...] mutation log
 */

import { ICommandService } from "@univerjs/core";
import { useEffect, useRef } from "react";
import { Awareness } from "y-protocols/awareness";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

import {
  registerAwareness,
  unregisterAwareness,
  updateConnectionStatus,
} from "../collab/awareness-store";

// ── Types ───────────────────────────────────────────────────────────────────

/** Serialized mutation stored in Y.Array */
interface CollabMutation {
  id: string;
  params: Record<string, unknown>;
  clientId: number;
}

function isShareableSheetMutation(id: string): boolean {
  // Univer uses doc.* mutations for transient rich-text editors such as the
  // formula bar and font controls. The final cell commit is emitted as a
  // sheet mutation, so replaying doc.* has no workbook target and always fails.
  return !id.startsWith("doc.");
}

/** Univer API surface we depend on (avoid importing internal types) */
interface UniverAPI {
  syncExecuteCommand: <P extends object = object>(
    id: string,
    params?: P,
    options?: { fromCollab?: boolean },
  ) => unknown;
  getActiveWorkbook: () => UniverWorkbook | null;
}

/** Minimal Univer workbook facade for selection listening */
interface UniverWorkbook {
  onSelectionChange: (
    callback: (
      selections: Array<{
        startRow: number;
        startColumn: number;
        endRow: number;
        endColumn: number;
      }>,
    ) => void,
  ) => { dispose: () => void };
}

/** ICommandService subset for collab */
interface CommandService {
  onMutationExecutedForCollab: (
    listener: (
      info: { id: string; type?: number; params?: Record<string, unknown> },
      options?: { fromCollab?: boolean; onlyLocal?: boolean },
    ) => void,
  ) => { dispose: () => void };
}

/** Univer instance with injector access */
interface UniverInstance {
  __getInjector: () => { get: (token: unknown) => unknown };
}

// ── WebSocket URL builder ───────────────────────────────────────────────────

function buildCollabWsUrl(spaceId: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  const port = window.location.port === "5173" ? "5678" : window.location.port;
  return `${proto}//${host}:${port}/api/apps/docs/spaces/${encodeURIComponent(spaceId)}/collab`;
}

// ── Hook ────────────────────────────────────────────────────────────────────

interface UseSheetCollabOptions {
  /** Doc node ID. null disables collab. */
  spaceId: string | null;
  nodeId: string | null;
  /** User display name for presence. */
  userName: string;
  /** The Univer instance (from createUniver().univer). */
  univer: UniverInstance | null;
  /** The Univer facade API (from createUniver().univerAPI). */
  univerAPI: UniverAPI | null;
  /** Ref that indicates remote replay is in progress (skip local saves). */
  isReplayingRef: React.MutableRefObject<boolean>;
  /** The initial workbook content from HTTP (used to seed Y.Map on room creation). */
  initialContent: unknown;
}

/**
 * Connects the Univer spreadsheet to a Yjs collaboration room.
 *
 * Manages: Y.Doc lifecycle, WebSocket transport, mutation forwarding,
 * remote mutation replay, and snapshot seeding for new rooms.
 */
export function useSheetCollab({
  spaceId,
  nodeId,
  userName,
  univer,
  univerAPI,
  isReplayingRef,
  initialContent,
}: UseSheetCollabOptions): void {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!spaceId || !nodeId || !univer || !univerAPI) return;

    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    const roomKey = nodeId;
    const wsUrl = buildCollabWsUrl(spaceId);

    // Set local awareness state
    awareness.setLocalStateField("user", {
      name: userName,
      color: randomCursorColor(),
    });

    const wsProvider = new WebsocketProvider(wsUrl, roomKey, doc, {
      connect: true,
      awareness,
      params: { nodeId },
    });

    // Register in shared store for CollabPresenceBar
    registerAwareness(roomKey, awareness, false);

    // Broadcast awareness null on tab close/refresh so peers see immediate removal
    const handleBeforeUnload = () => {
      awareness.setLocalState(null);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    wsProvider.on("status", ({ status }: { status: string }) => {
      updateConnectionStatus(roomKey, status === "connected");
    });

    const sheetMap = doc.getMap("sheet");
    const sheetOps = doc.getArray<CollabMutation>("sheet-ops");

    let mutationDisposable: { dispose: () => void } | null = null;
    let selectionDisposable: { dispose: () => void } | null = null;
    let observerAttached = false;

    const handleRemoteSheetOps = (event: Y.YArrayEvent<CollabMutation>) => {
      if (event.transaction.local) return;

      isReplayingRef.current = true;
      for (const delta of event.changes.delta) {
        if ("insert" in delta) {
          const items = delta.insert as CollabMutation[];
          for (const op of items) {
            if (op.clientId === doc.clientID) continue;
            if (!isShareableSheetMutation(op.id)) continue;
            try {
              univerAPI.syncExecuteCommand(op.id, op.params, {
                fromCollab: true,
              });
            } catch (e) {
              console.warn(
                "[SheetCollab] Failed to apply remote mutation:",
                op.id,
                e,
              );
            }
          }
        }
      }
      isReplayingRef.current = false;
    };

    // Wait for initial sync, then set up forwarding
    const onSync = (synced: boolean) => {
      if (!synced) return;
      wsProvider.off("sync", onSync);

      // Seed snapshot if this is a new room (no existing snapshot)
      if (!sheetMap.get("snapshot")) {
        const data = initialContent;
        if (
          data &&
          typeof data === "object" &&
          "id" in (data as Record<string, unknown>)
        ) {
          sheetMap.set("snapshot", data);
        }
      }

      // Replay any existing mutations (added since room creation)
      const existingOps = sheetOps.toArray();
      if (existingOps.length > 0) {
        isReplayingRef.current = true;
        for (const op of existingOps) {
          if (!isShareableSheetMutation(op.id)) continue;
          try {
            univerAPI.syncExecuteCommand(op.id, op.params, {
              fromCollab: true,
            });
          } catch (e) {
            console.warn("[SheetCollab] Failed to replay mutation:", op.id, e);
          }
        }
        isReplayingRef.current = false;
      }

      // Set up remote mutation observer (only fires for NEW additions)
      sheetOps.observe(handleRemoteSheetOps);
      observerAttached = true;

      // Set up local mutation forwarding
      try {
        const injector = univer.__getInjector();
        const commandService = injector.get(ICommandService) as CommandService;

        mutationDisposable = commandService.onMutationExecutedForCollab(
          (info, options) => {
            if (options?.fromCollab) return;
            if (!info.params) return;
            if (!isShareableSheetMutation(info.id)) return;

            // Validate params are JSON-safe before forwarding
            try {
              JSON.stringify(info.params);
            } catch {
              console.warn(
                "[SheetCollab] Non-serializable mutation skipped:",
                info.id,
              );
              return;
            }

            sheetOps.push([
              {
                id: info.id,
                params: info.params as Record<string, unknown>,
                clientId: doc.clientID,
              },
            ]);
          },
        );
      } catch (e) {
        console.warn("[SheetCollab] Failed to set up mutation forwarding:", e);
      }

      // Broadcast local cell selection via awareness
      try {
        const workbook = univerAPI.getActiveWorkbook?.();
        if (workbook) {
          selectionDisposable = workbook.onSelectionChange((selections) => {
            awareness.setLocalStateField(
              "selection",
              selections.map((s) => ({
                startRow: s.startRow,
                startColumn: s.startColumn,
                endRow: s.endRow,
                endColumn: s.endColumn,
              })),
            );
          });
        }
      } catch (e) {
        console.warn("[SheetCollab] Failed to set up selection sync:", e);
      }
    };

    wsProvider.on("sync", onSync);

    // Store cleanup
    cleanupRef.current = () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      mutationDisposable?.dispose();
      selectionDisposable?.dispose();
      if (observerAttached) {
        sheetOps.unobserve(handleRemoteSheetOps);
      }
      // Broadcast cursor removal to peers BEFORE closing the WebSocket
      awareness.setLocalState(null);
      unregisterAwareness(roomKey);
      wsProvider.destroy();
      doc.destroy();
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [
    spaceId,
    nodeId,
    userName,
    univer,
    univerAPI,
    isReplayingRef,
    initialContent,
  ]);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** A palette of visually distinct cursor colors. Each tab picks one at random. */
const CURSOR_COLORS = [
  "#F44336",
  "#E91E63",
  "#9C27B0",
  "#673AB7",
  "#3F51B5",
  "#2196F3",
  "#03A9F4",
  "#00BCD4",
  "#009688",
  "#4CAF50",
  "#8BC34A",
  "#FF9800",
  "#FF5722",
  "#795548",
  "#607D8B",
];

function randomCursorColor(): string {
  return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
}
