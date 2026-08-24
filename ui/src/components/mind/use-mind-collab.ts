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

import type { MindElixirData, MindElixirInstance, Theme } from "mind-elixir";
import { useCallback, useEffect, useRef } from "react";
import { Awareness } from "y-protocols/awareness";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

import {
  registerAwareness,
  unregisterAwareness,
  updateConnectionStatus,
} from "../collab/awareness-store";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Strip embedded theme from data so refresh() won't override our custom theme. */
function stripTheme(data: MindElixirData): MindElixirData {
  const { theme: _, ...rest } = data;
  return rest as MindElixirData;
}

// ── WebSocket URL builder ───────────────────────────────────────────────────

function buildCollabWsUrl(spaceId: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  const port = window.location.port === "5173" ? "5678" : window.location.port;
  return `${proto}//${host}:${port}/api/apps/docs/spaces/${encodeURIComponent(spaceId)}/collab`;
}

// ── Hook ────────────────────────────────────────────────────────────────────

interface UseMindCollabOptions {
  /** Doc node ID. null disables collab. */
  spaceId: string | null;
  nodeId: string | null;
  /** User display name for presence. */
  userName: string;
  /** The mind-elixir instance (null while initializing). */
  mind: MindElixirInstance | null;
  /** Ref that indicates remote replay is in progress (skip local saves). */
  isReplayingRef: React.MutableRefObject<boolean>;
  /** Custom theme to re-apply after each remote refresh (prevents theme override). */
  customTheme?: Theme;
}

/**
 * Connects a mind-elixir instance to a Yjs collaboration room.
 *
 * Manages: Y.Doc lifecycle, WebSocket transport, snapshot sync,
 * remote refresh, and awareness/presence.
 */
export function useMindCollab({
  spaceId,
  nodeId,
  userName,
  mind,
  isReplayingRef,
  customTheme,
}: UseMindCollabOptions): (data: MindElixirData) => void {
  const cleanupRef = useRef<(() => void) | null>(null);
  const customThemeRef = useRef(customTheme);
  customThemeRef.current = customTheme;
  const mindMapRef = useRef<Y.Map<unknown> | null>(null);
  const pendingLocalSnapshotRef = useRef<MindElixirData | null>(null);

  const publishSnapshot = useCallback((data: MindElixirData) => {
    const snapshot = JSON.parse(
      JSON.stringify(stripTheme(data)),
    ) as MindElixirData;
    const mindMap = mindMapRef.current;
    if (mindMap) {
      mindMap.set("snapshot", snapshot);
      pendingLocalSnapshotRef.current = null;
    } else {
      pendingLocalSnapshotRef.current = snapshot;
    }
  }, []);

  useEffect(() => {
    if (!spaceId || !nodeId || !mind) return;

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

    // Broadcast awareness null on tab close/refresh
    const handleBeforeUnload = () => {
      awareness.setLocalState(null);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    wsProvider.on("status", ({ status }: { status: string }) => {
      updateConnectionStatus(roomKey, status === "connected");
    });

    const mindMap = doc.getMap("mindmap");
    mindMapRef.current = mindMap;
    let observerAttached = false;
    let localOperationListener: (() => void) | null = null;

    const handleRemoteSnapshot = (event: Y.YMapEvent<unknown>) => {
      if (event.transaction.local) return;

      const snapshot = mindMap.get("snapshot") as MindElixirData | undefined;
      if (!snapshot?.nodeData) return;

      try {
        isReplayingRef.current = true;
        mind.refresh(stripTheme(snapshot) as MindElixirData);
        if (customThemeRef.current)
          mind.changeTheme(customThemeRef.current, false);
        isReplayingRef.current = false;
      } catch (e) {
        console.warn("[MindCollab] Failed to apply remote snapshot:", e);
        isReplayingRef.current = false;
      }
    };

    // Wait for initial sync, then set up forwarding
    const onSync = (synced: boolean) => {
      if (!synced) return;
      wsProvider.off("sync", onSync);

      // Seed snapshot if this is a new room
      const pendingLocalSnapshot = pendingLocalSnapshotRef.current;
      const existing = mindMap.get("snapshot");
      if (pendingLocalSnapshot) {
        mindMap.set("snapshot", pendingLocalSnapshot);
        pendingLocalSnapshotRef.current = null;
      } else if (!existing) {
        const data = stripTheme(mind.getData());
        mindMap.set("snapshot", JSON.parse(JSON.stringify(data)));
      } else {
        // Load remote snapshot into local mind-elixir
        try {
          const remoteData = stripTheme(existing as MindElixirData);
          if (remoteData?.nodeData) {
            isReplayingRef.current = true;
            mind.refresh(remoteData as MindElixirData);
            if (customThemeRef.current)
              mind.changeTheme(customThemeRef.current, false);
            isReplayingRef.current = false;
          }
        } catch (e) {
          console.warn("[MindCollab] Failed to load remote snapshot:", e);
        }
      }

      // Observe remote snapshot changes
      mindMap.observe(handleRemoteSnapshot);
      observerAttached = true;

      // Forward local operations to Y.Map
      const handleLocalOperation = () => {
        if (isReplayingRef.current) return;
        const data = stripTheme(mind.getData());
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
      try {
        localOperationListener?.();
      } catch {
        // mind-elixir instance may already be destroyed
      }
      if (observerAttached) {
        mindMap.unobserve(handleRemoteSnapshot);
      }
      awareness.setLocalState(null);
      unregisterAwareness(roomKey);
      wsProvider.destroy();
      doc.destroy();
      if (mindMapRef.current === mindMap) mindMapRef.current = null;
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [spaceId, nodeId, userName, mind, isReplayingRef]);

  return publishSnapshot;
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
