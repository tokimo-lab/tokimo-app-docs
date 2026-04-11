/**
 * useMindCollab — Yjs-based real-time collaboration for mind-elixir mind maps.
 *
 * Since mind-elixir doesn't expose a mutation forwarding API like Univer,
 * we sync the full MindElixirData snapshot via a Y.Map. On each local
 * operation the snapshot is updated in the Y.Map; remote changes trigger
 * a full refresh() on the mind-elixir instance.
 *
 * Y.Doc structure:
 *   Y.Map("mindmap") → "snapshot": MindElixirData JSON (full state)
 */

import type { MindElixirData, MindElixirInstance } from "mind-elixir";
import { useEffect, useRef } from "react";
import { Awareness } from "y-protocols/awareness";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

import {
  registerAwareness,
  unregisterAwareness,
  updateConnectionStatus,
} from "../collab/awareness-store";

// ── WebSocket URL builder ───────────────────────────────────────────────────

function buildCollabWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  const port = window.location.port === "5173" ? "5678" : window.location.port;
  return `${proto}//${host}:${port}/api/apps/docs/collab`;
}

// ── Hook ────────────────────────────────────────────────────────────────────

interface UseMindCollabOptions {
  /** Doc node ID. null disables collab. */
  nodeId: string | null;
  /** User display name for presence. */
  userName: string;
  /** The mind-elixir instance (null while initializing). */
  mind: MindElixirInstance | null;
  /** Ref that indicates remote replay is in progress (skip local saves). */
  isReplayingRef: React.MutableRefObject<boolean>;
}

/**
 * Connects a mind-elixir instance to a Yjs collaboration room.
 *
 * Manages: Y.Doc lifecycle, WebSocket transport, snapshot sync,
 * remote refresh, and awareness/presence.
 */
export function useMindCollab({
  nodeId,
  userName,
  mind,
  isReplayingRef,
}: UseMindCollabOptions): void {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!nodeId || !mind) return;

    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    const wsUrl = buildCollabWsUrl();

    // Set local awareness state
    awareness.setLocalStateField("user", {
      name: userName,
      color: randomCursorColor(),
    });

    const wsProvider = new WebsocketProvider(wsUrl, nodeId, doc, {
      connect: true,
      awareness,
    });

    // Register in shared store for CollabPresenceBar
    registerAwareness(nodeId, awareness, false);

    // Broadcast awareness null on tab close/refresh
    const handleBeforeUnload = () => {
      awareness.setLocalState(null);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    wsProvider.on("status", ({ status }: { status: string }) => {
      updateConnectionStatus(nodeId, status === "connected");
    });

    const mindMap = doc.getMap("mindmap");
    let observerAttached = false;
    let localOperationListener: (() => void) | null = null;

    // Wait for initial sync, then set up forwarding
    const onSync = (synced: boolean) => {
      if (!synced) return;
      wsProvider.off("sync", onSync);

      // Seed snapshot if this is a new room
      const existing = mindMap.get("snapshot");
      if (!existing) {
        const data = mind.getData();
        mindMap.set("snapshot", JSON.parse(JSON.stringify(data)));
      } else {
        // Load remote snapshot into local mind-elixir
        try {
          const remoteData = existing as MindElixirData;
          if (remoteData?.nodeData) {
            isReplayingRef.current = true;
            mind.refresh(remoteData);
            isReplayingRef.current = false;
          }
        } catch (e) {
          console.warn("[MindCollab] Failed to load remote snapshot:", e);
        }
      }

      // Observe remote snapshot changes
      mindMap.observe((event) => {
        if (event.transaction.local) return;

        const snapshot = mindMap.get("snapshot") as MindElixirData | undefined;
        if (!snapshot?.nodeData) return;

        try {
          isReplayingRef.current = true;
          mind.refresh(snapshot);
          isReplayingRef.current = false;
        } catch (e) {
          console.warn("[MindCollab] Failed to apply remote snapshot:", e);
          isReplayingRef.current = false;
        }
      });
      observerAttached = true;

      // Forward local operations to Y.Map
      const handleLocalOperation = () => {
        if (isReplayingRef.current) return;
        const data = mind.getData();
        // Deep clone to avoid Yjs reference issues
        mindMap.set("snapshot", JSON.parse(JSON.stringify(data)));
      };

      mind.bus.addListener("operation", handleLocalOperation);
      localOperationListener = () => {
        mind.bus.removeListener("operation", handleLocalOperation);
      };
    };

    wsProvider.on("sync", onSync);

    // Store cleanup
    cleanupRef.current = () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      localOperationListener?.();
      if (observerAttached) {
        mindMap.unobserve(() => {});
      }
      awareness.setLocalState(null);
      unregisterAwareness(nodeId);
      wsProvider.destroy();
      awareness.destroy();
      doc.destroy();
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [nodeId, userName, mind, isReplayingRef]);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
