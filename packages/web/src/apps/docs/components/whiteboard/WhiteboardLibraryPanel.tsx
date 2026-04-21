/**
 * WhiteboardLibraryPanel — Browse and add public Excalidraw libraries.
 *
 * Shown as a sidebar panel inside the whiteboard editor.
 * Fetches the library catalog from our backend proxy, displays previews,
 * and allows one-click addition to the user's excalidraw library.
 */

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { cn } from "@tokimo/ui";
import { Check, Library, Plus, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/generated/rust-api";
import { rustUrl } from "@/lib/rust-api-runtime";

interface WhiteboardLibraryPanelProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onClose: () => void;
}

export function WhiteboardLibraryPanel({
  excalidrawAPI,
  onClose,
}: WhiteboardLibraryPanelProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);

  const {
    data: libraries,
    isLoading,
    error,
    refetch,
  } = api.docs.whiteboardLibrary.listLibraries.useQuery();

  const filtered = useMemo(() => {
    if (!libraries) return [];
    if (!search.trim()) return libraries;
    const q = search.toLowerCase();
    return libraries.filter(
      (lib) =>
        lib.name.toLowerCase().includes(q) ||
        lib.description.toLowerCase().includes(q) ||
        lib.itemNames?.some((n) => n.toLowerCase().includes(q)),
    );
  }, [libraries, search]);

  const handleAdd = useCallback(
    async (libraryId: string) => {
      if (!excalidrawAPI || addingId || addedIds.has(libraryId)) return;
      setAddingId(libraryId);
      try {
        const url = rustUrl(
          `/api/apps/docs/whiteboard/libraries/${libraryId}/download`,
        );
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // New format: { libraryItems: [{id,status,elements,...}] }
        // Old format: { library: [[element,...], ...] }
        let items = data.libraryItems;
        if (!items && Array.isArray(data.library)) {
          items = data.library.map((elements: unknown[], i: number) => ({
            id: `${libraryId}_${i}`,
            status: "published",
            elements,
            created: Date.now(),
          }));
        }
        items = items ?? [];
        if (items.length > 0) {
          await excalidrawAPI.updateLibrary({
            libraryItems: items,
            merge: true,
            openLibraryMenu: true,
            defaultStatus: "published",
          });
          setAddedIds((prev) => new Set([...prev, libraryId]));
        }
      } catch (err) {
        console.error("Failed to add library:", err);
      } finally {
        setAddingId(null);
      }
    },
    [excalidrawAPI, addingId, addedIds],
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700 w-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          <Library className="w-4 h-4" />
          {t("docs.whiteboardLibrary")}
        </div>
        <button
          type="button"
          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-zinc-500"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("docs.whiteboardLibrarySearch")}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 outline-none focus:border-[var(--accent)] dark:focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-sm text-zinc-400">
            {t("docs.whiteboardLibraryLoading")}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-zinc-400">
            <span>{t("docs.whiteboardLibraryError")}</span>
            <button
              type="button"
              className="flex items-center gap-1 px-3 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 cursor-pointer text-xs"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-3 h-3" />
              {t("docs.whiteboardLibraryRetry")}
            </button>
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex items-center justify-center py-8 text-sm text-zinc-400">
            {t("docs.whiteboardLibraryEmpty")}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          {filtered.map((lib) => {
            const isAdded = addedIds.has(lib.id);
            const isAdding = addingId === lib.id;
            return (
              <div
                key={lib.id}
                className="group rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:border-[var(--accent)] dark:hover:border-[var(--accent)] transition-colors"
              >
                {/* Preview image */}
                <div className="relative aspect-[2/1] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <img
                    src={rustUrl(
                      `/api/apps/docs/whiteboard/libraries/${lib.id}/preview`,
                    )}
                    alt={lib.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>

                {/* Info */}
                <div className="px-2.5 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                        {lib.name}
                      </div>
                      {lib.authors.length > 0 && (
                        <div className="text-xs text-zinc-400 mt-0.5 truncate">
                          {t("docs.whiteboardLibraryBy", {
                            name: lib.authors.map((a) => a.name).join(", "),
                          })}
                        </div>
                      )}
                      {lib.itemCount != null && lib.itemCount > 0 && (
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {t("docs.whiteboardLibraryItems", {
                            count: lib.itemCount,
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className={cn(
                        "flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-colors",
                        isAdded
                          ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                          : "bg-[var(--accent-subtle)] text-[var(--accent)] hover:bg-[var(--accent-subtle)] dark:hover:bg-[var(--accent-subtle)]",
                      )}
                      disabled={isAdded || isAdding}
                      onClick={() => handleAdd(lib.id)}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3 h-3" />
                          {t("docs.whiteboardLibraryAdded")}
                        </>
                      ) : isAdding ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          {t("docs.whiteboardLibraryAdd")}
                        </>
                      )}
                    </button>
                  </div>

                  {lib.description && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 line-clamp-2">
                      {lib.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
