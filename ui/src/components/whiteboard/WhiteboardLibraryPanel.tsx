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
import { api, fetchWhiteboardLibraryDownload } from "../../api/generated";

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
  const [addError, setAddError] = useState(false);

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
      setAddError(false);
      try {
        const data = (await fetchWhiteboardLibraryDownload(libraryId)) as {
          libraryItems?: unknown[];
          library?: unknown[][];
        };
        // New format: { libraryItems: [{id,status,elements,...}] }
        // Old format: { library: [[element,...], ...] }
        let items: unknown[] = data.libraryItems ?? [];
        if (items.length === 0 && Array.isArray(data.library)) {
          items = data.library.map((elements: unknown[], i: number) => ({
            id: `${libraryId}_${i}`,
            status: "published",
            elements,
            created: Date.now(),
          }));
        }
        if (items.length > 0) {
          await excalidrawAPI.updateLibrary({
            libraryItems: items as Parameters<
              typeof excalidrawAPI.updateLibrary
            >[0]["libraryItems"],
            merge: true,
            openLibraryMenu: true,
            defaultStatus: "published",
          });
          setAddedIds((prev) => new Set([...prev, libraryId]));
        }
      } catch (err) {
        console.error("Failed to add library:", err);
        setAddError(true);
      } finally {
        setAddingId(null);
      }
    },
    [excalidrawAPI, addingId, addedIds],
  );

  return (
    <div className="flex h-full w-80 flex-col border-l border-border-base bg-surface-raised text-fg-on-raised">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-base px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-fg-secondary">
          <Library className="w-4 h-4" />
          {t("docs.whiteboardLibrary")}
        </div>
        <button
          type="button"
          aria-label={t("docs.whiteboardLibraryClose")}
          className="cursor-pointer rounded p-1 text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("docs.whiteboardLibrarySearch")}
            className="w-full rounded-md border border-border-base bg-surface-base py-1.5 pr-3 pl-8 text-sm text-fg-primary outline-none placeholder:text-fg-muted focus:border-accent"
          />
        </div>
        {addError && (
          <p className="mt-1.5 text-xs text-status-error">
            {t("docs.whiteboardLibraryAddError")}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-sm text-fg-muted">
            {t("docs.whiteboardLibraryLoading")}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-fg-muted">
            <span>{t("docs.whiteboardLibraryError")}</span>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1 rounded bg-fill-tertiary px-3 py-1 text-xs text-fg-secondary transition-colors hover:bg-fill-secondary"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-3 h-3" />
              {t("docs.whiteboardLibraryRetry")}
            </button>
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex items-center justify-center py-8 text-sm text-fg-muted">
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
                className="group overflow-hidden rounded-lg border border-border-base transition-colors hover:border-accent"
              >
                {/* Preview image */}
                <div className="relative aspect-[2/1] overflow-hidden bg-fill-tertiary">
                  <img
                    src={`/api/apps/docs/whiteboard/libraries/${lib.id}/preview`}
                    alt={lib.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>

                {/* Info */}
                <div className="px-2.5 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium text-fg-secondary">
                        {lib.name}
                      </div>
                      {lib.authors.length > 0 && (
                        <div className="mt-0.5 truncate text-xs text-fg-muted">
                          {t("docs.whiteboardLibraryBy", {
                            author: lib.authors.map((a) => a.name).join(", "),
                          })}
                        </div>
                      )}
                      {lib.itemCount != null && lib.itemCount > 0 && (
                        <div className="mt-0.5 text-xs text-fg-muted">
                          {t("docs.whiteboardLibraryItems", {
                            count: lib.itemCount,
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className={cn(
                        "flex flex-shrink-0 cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed",
                        isAdded
                          ? "bg-status-success/10 text-status-success"
                          : "bg-accent-subtle text-accent-text hover:bg-accent-subtle/80",
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
                    <div className="mt-1.5 line-clamp-2 text-xs text-fg-muted">
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
