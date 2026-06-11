/**
 * useWhiteboardLibraryAdapter — Persistence adapter for Excalidraw's useHandleLibrary.
 *
 * Persists user's library items to the backend instead of localStorage.
 */

import { useHandleLibrary } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useMemo } from "react";
import {
  getWhiteboardUserLibrary,
  saveWhiteboardUserLibrary,
} from "../../api/client";

export function useWhiteboardLibraryAdapter(
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) {
  const load = useCallback(async () => {
    try {
      const data = (await getWhiteboardUserLibrary()) as {
        items: unknown[];
      };
      return { libraryItems: data.items as never[] };
    } catch {
      return { libraryItems: [] };
    }
  }, []);

  const save = useCallback(
    async (libraryData: { libraryItems: readonly unknown[] }) => {
      try {
        await saveWhiteboardUserLibrary(libraryData.libraryItems);
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
