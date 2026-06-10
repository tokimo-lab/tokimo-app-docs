/**
 * useWhiteboardLibraryAdapter — Persistence adapter for Excalidraw's useHandleLibrary.
 *
 * Persists user's library items to the backend instead of localStorage.
 */

import { useHandleLibrary } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useMemo } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { rustUrl } from "@/lib/rust-api-runtime";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(rustUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.success === false) throw new Error(json.error ?? "API error");
  return json.data;
}

export function useWhiteboardLibraryAdapter(
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) {
  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: unknown[] }>(
        "/api/apps/docs/whiteboard/user-library",
      );
      return { libraryItems: data.items as never[] };
    } catch {
      return { libraryItems: [] };
    }
  }, []);

  const save = useCallback(
    async (libraryData: { libraryItems: readonly unknown[] }) => {
      try {
        await apiFetch<void>("/api/apps/docs/whiteboard/user-library", {
          method: "PUT",
          body: JSON.stringify({ items: libraryData.libraryItems }),
        });
      } catch (err) {
        console.error("Failed to save library:", err);
      }
    },
    [],
  );

  const adapter = useMemo(() => ({ load, save }), [load, save]);

  useHandleLibrary({
    excalidrawAPI,
    adapter,
  });
}
