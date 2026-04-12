import { useEffect, useRef } from "react";
import { Awareness } from "y-protocols/awareness";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import {
  registerAwareness,
  unregisterAwareness,
  updateConnectionStatus,
} from "../collab/awareness-store";
import type { SlidePresentation } from "./types";
import { isSlidePresentation } from "./types";
import { useSlideStore } from "./use-slide-store";

function buildCollabWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  const port = window.location.port === "5173" ? "5678" : window.location.port;
  return `${proto}//${host}:${port}/api/apps/docs/collab`;
}

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

interface UseSlideCollabOptions {
  nodeId: string | null;
  userName: string;
  getPresentation: () => SlidePresentation;
  setPresentation: (p: SlidePresentation) => void;
  isReplayingRef: React.MutableRefObject<boolean>;
}

export function useSlideCollab({
  nodeId,
  userName,
  getPresentation,
  setPresentation,
  isReplayingRef,
}: UseSlideCollabOptions): void {
  const getPresentationRef = useRef(getPresentation);
  getPresentationRef.current = getPresentation;
  const setPresentationRef = useRef(setPresentation);
  setPresentationRef.current = setPresentation;

  useEffect(() => {
    if (!nodeId) return;

    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    const wsUrl = buildCollabWsUrl();

    awareness.setLocalStateField("user", {
      name: userName,
      color: randomCursorColor(),
    });

    const wsProvider = new WebsocketProvider(wsUrl, nodeId, doc, {
      connect: true,
      awareness,
    });

    registerAwareness(nodeId, awareness, false);

    const handleBeforeUnload = () => {
      awareness.setLocalState(null);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    wsProvider.on("status", ({ status }: { status: string }) => {
      updateConnectionStatus(nodeId, status === "connected");
    });

    const slidesMap = doc.getMap("slides");
    let storeUnsub: (() => void) | null = null;

    const onSync = (synced: boolean) => {
      if (!synced) return;
      wsProvider.off("sync", onSync);

      const existing = slidesMap.get("snapshot");
      if (!existing) {
        const data = getPresentationRef.current();
        slidesMap.set("snapshot", JSON.parse(JSON.stringify(data)));
      } else {
        try {
          if (isSlidePresentation(existing)) {
            isReplayingRef.current = true;
            setPresentationRef.current(JSON.parse(JSON.stringify(existing)));
            isReplayingRef.current = false;
          }
        } catch (e) {
          console.warn("[SlideCollab] Failed to load remote snapshot:", e);
        }
      }

      // Observe remote changes
      slidesMap.observe((event) => {
        if (event.transaction.local) return;
        const snapshot = slidesMap.get("snapshot");
        if (!isSlidePresentation(snapshot)) return;
        try {
          isReplayingRef.current = true;
          setPresentationRef.current(JSON.parse(JSON.stringify(snapshot)));
          isReplayingRef.current = false;
        } catch (e) {
          console.warn("[SlideCollab] Failed to apply remote snapshot:", e);
          isReplayingRef.current = false;
        }
      });

      // Forward local changes to Y.Map
      storeUnsub = useSlideStore.subscribe(() => {
        if (isReplayingRef.current) return;
        const current = useSlideStore.getState();
        slidesMap.set(
          "snapshot",
          JSON.parse(JSON.stringify(current.presentation)),
        );
      });
    };

    wsProvider.on("sync", onSync);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      storeUnsub?.();
      awareness.setLocalState(null);
      unregisterAwareness(nodeId);
      wsProvider.destroy();
      awareness.destroy();
      doc.destroy();
    };
  }, [nodeId, userName, isReplayingRef]);
}
