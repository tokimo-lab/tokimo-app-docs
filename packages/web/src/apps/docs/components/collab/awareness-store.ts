/**
 * Module-level store for Yjs awareness instances.
 *
 * Both Plate (collab-provider.ts) and Univer (use-sheet-collab.ts) register
 * their awareness here so that CollabPresenceBar can read online users
 * without needing a direct reference to the editor's internals.
 */

import { useEffect, useState } from "react";
import type { Awareness } from "y-protocols/awareness";

// ── Store ───────────────────────────────────────────────────────────────────

interface CollabEntry {
  awareness: Awareness;
  connected: boolean;
}

const entries = new Map<string, CollabEntry>();
const subscribers = new Set<() => void>();

function notifyAll() {
  for (const cb of subscribers) cb();
}

export function registerAwareness(
  nodeId: string,
  awareness: Awareness,
  connected: boolean,
): void {
  entries.set(nodeId, { awareness, connected });
  notifyAll();
}

export function updateConnectionStatus(
  nodeId: string,
  connected: boolean,
): void {
  const entry = entries.get(nodeId);
  if (entry) {
    entry.connected = connected;
    notifyAll();
  }
}

export function unregisterAwareness(nodeId: string): void {
  entries.delete(nodeId);
  notifyAll();
}

/** Get the raw Awareness instance for a node (used by sheet cursor overlay). */
export function getAwareness(nodeId: string): Awareness | null {
  return entries.get(nodeId)?.awareness ?? null;
}

// ── User state derived from awareness ───────────────────────────────────────

export interface CollabUser {
  clientId: number;
  name: string;
  color: string;
}

function getPresenceSnapshot(nodeId: string | null): {
  users: CollabUser[];
  connected: boolean;
} {
  if (!nodeId) return { users: [], connected: false };
  const entry = entries.get(nodeId);
  if (!entry) return { users: [], connected: false };

  const users: CollabUser[] = [];
  const localId = entry.awareness.clientID;

  for (const [clientId, state] of entry.awareness.getStates()) {
    if (clientId === localId) continue;
    const user = state.user as { name?: string; color?: string } | undefined;
    if (!user?.name) continue;
    users.push({
      clientId,
      name: user.name,
      color: user.color ?? "#888",
    });
  }

  return { users, connected: entry.connected };
}

// ── React hook ──────────────────────────────────────────────────────────────

const EMPTY: { users: CollabUser[]; connected: boolean } = {
  users: [],
  connected: false,
};

/**
 * Subscribe to collab presence for a given node.
 * Returns the list of remote online users and connection status.
 */
export function useCollabPresence(nodeId: string | null): {
  users: CollabUser[];
  connected: boolean;
} {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!nodeId) {
      setState(EMPTY);
      return;
    }

    const refresh = () => setState(getPresenceSnapshot(nodeId));

    // Subscribe to store-level changes (register/unregister/connection)
    subscribers.add(refresh);

    // Subscribe to awareness-level changes (user join/leave)
    const entry = entries.get(nodeId);
    entry?.awareness.on("change", refresh);

    // Initial snapshot
    refresh();

    return () => {
      subscribers.delete(refresh);
      entry?.awareness.off("change", refresh);
    };
  }, [nodeId]);

  return state;
}
