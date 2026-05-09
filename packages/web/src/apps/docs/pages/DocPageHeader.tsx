/**
 * DocPageHeader — Unified breadcrumb header for the docs app.
 *
 * Renders a single fixed-height header with:
 *  - Optional back button (when not at root)
 *  - Breadcrumb: 文档 / FolderA / FolderB / current
 *  - Right-side action slot (collab presence, AI, version, comment buttons, etc.)
 *
 * Used by both folder browser view and file detail view, so the header layout
 * stays stable while only the body underneath swaps.
 */

import { ArrowLeft, ChevronRight, Folder } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";

interface DocCrumbNode {
  title: string;
  icon: string | null;
}

export interface DocPageHeaderProps {
  /** Current relative path (folder or file). null = root. */
  currentRelPath: string | null;
  /**
   * If currentRelPath points to a leaf doc, pass its display info here so the
   * last crumb is rendered as the doc title (non-clickable). For folder view,
   * leave undefined — the last segment of currentRelPath is treated as a
   * non-clickable folder name.
   */
  leaf?: DocCrumbNode | null;
  /** Map relPath -> node display info, used to resolve ancestor crumb labels. */
  nodeByPath: Map<string, DocCrumbNode>;
  /** Click ancestor crumb. null = root ("文档"). */
  onNavigateFolder: (relPath: string | null) => void;
  /** Optional back button click handler. If absent or path empty, hidden. */
  onBack?: () => void;
  /** Suffix shown after root when in special tab modes (favorites/archived). */
  viewModeSuffix?: "favorites" | "archived" | null;
  /** Right-side action slot. */
  right?: ReactNode;
  /** Root label. Default 文档. */
  rootLabel?: string;
}

export function DocPageHeader({
  currentRelPath,
  leaf,
  nodeByPath,
  onNavigateFolder,
  onBack,
  viewModeSuffix,
  right,
  rootLabel = "文档",
}: DocPageHeaderProps) {
  const segments = useMemo(
    () => (currentRelPath ? currentRelPath.split("/").filter(Boolean) : []),
    [currentRelPath],
  );

  // Ancestor crumbs (clickable). For both folder and leaf modes, this is
  // segments.slice(0, -1) — the last segment is the current location.
  const ancestors = useMemo(() => {
    return segments.slice(0, -1).map((_, i) => {
      const relPath = segments.slice(0, i + 1).join("/");
      const node = nodeByPath.get(relPath);
      const fallback = relPath.split("/").pop() ?? relPath;
      return {
        relPath,
        title: node?.title ?? fallback,
        icon: node?.icon ?? null,
      };
    });
  }, [segments, nodeByPath]);

  // Final non-clickable label.
  const final = useMemo<DocCrumbNode | null>(() => {
    if (leaf) return leaf;
    if (segments.length > 0) {
      const lastSeg = segments[segments.length - 1];
      const node = nodeByPath.get(segments.join("/"));
      return { title: node?.title ?? lastSeg, icon: node?.icon ?? null };
    }
    if (viewModeSuffix === "favorites") return { title: "收藏", icon: null };
    if (viewModeSuffix === "archived") return { title: "回收站", icon: null };
    return null;
  }, [leaf, segments, nodeByPath, viewModeSuffix]);

  const showBack = !!onBack && (segments.length > 0 || !!viewModeSuffix);

  return (
    <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-2">
      {showBack && (
        <button
          type="button"
          onClick={onBack}
          className="mr-1 flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary"
          title="返回"
        >
          <ArrowLeft size={14} />
        </button>
      )}
      <div className="flex flex-1 items-center gap-1 text-sm">
        <Folder size={14} className="text-fg-muted" />
        <button
          type="button"
          onClick={() => onNavigateFolder(null)}
          className={`cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-fill-tertiary ${
            final == null
              ? "font-medium text-fg-primary"
              : "text-fg-muted hover:text-fg-secondary"
          }`}
        >
          {rootLabel}
        </button>
        {ancestors.map((crumb) => (
          <span key={crumb.relPath} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-fg-muted" />
            <button
              type="button"
              onClick={() => onNavigateFolder(crumb.relPath)}
              className="cursor-pointer rounded px-1 py-0.5 text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary"
            >
              {crumb.icon ? `${crumb.icon} ` : ""}
              {crumb.title}
            </button>
          </span>
        ))}
        {final && (
          <span className="flex items-center gap-1">
            <ChevronRight size={14} className="text-fg-muted" />
            <span className="px-1 py-0.5 font-medium text-fg-primary">
              {final.icon ? `${final.icon} ` : ""}
              {final.title}
            </span>
          </span>
        )}
      </div>
      {right && <div className="flex items-center gap-1">{right}</div>}
    </div>
  );
}
