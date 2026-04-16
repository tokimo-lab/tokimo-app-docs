/**
 * DocNodeTip — Hover tooltip for document / folder nodes.
 *
 * Pattern borrowed from the media module's PersonPanel (Floating-UI +
 * delayed enter/leave + glass morphism).  Designed for reuse across any
 * node type in the docs app (and future slide / sheet / form apps).
 */

import {
  autoUpdate,
  FloatingPortal,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import { FileText, Folder, Heart, Pin, Tag } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocNode } from "../lib/doc-node";
import {
  formatRelativeTime,
  formatWordCount,
  untitledI18nKey,
} from "../lib/doc-node";

// ── Types ──────────────────────────────────────────────────────────────────

interface HoveredState {
  node: DocNode;
}

// ── Hook: useDocNodeTip ────────────────────────────────────────────────────

export function useDocNodeTip() {
  const [hovered, setHovered] = useState<HoveredState | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [sliding, setSliding] = useState(false);

  const enterTimer = useRef<number>(0);
  const leaveTimer = useRef<number>(0);
  const fadeOutTimer = useRef<number>(0);

  const { refs, floatingStyles } = useFloating({
    open: mounted,
    placement: "right-start",
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const cancelLeave = useCallback(() => {
    clearTimeout(leaveTimer.current);
    clearTimeout(fadeOutTimer.current);
  }, []);

  const enter = useCallback(
    (el: HTMLElement, node: DocNode) => {
      clearTimeout(leaveTimer.current);
      clearTimeout(fadeOutTimer.current);
      clearTimeout(enterTimer.current);
      const wasVisible = visible;
      enterTimer.current = window.setTimeout(
        () => {
          refs.setReference(el);
          setHovered({ node });
          setMounted(true);
          setSliding(wasVisible);
          requestAnimationFrame(() => setVisible(true));
        },
        wasVisible ? 0 : 400,
      );
    },
    [refs, visible],
  );

  const leave = useCallback(() => {
    clearTimeout(enterTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      setVisible(false);
      setSliding(false);
      fadeOutTimer.current = window.setTimeout(() => {
        setMounted(false);
        setHovered(null);
      }, 150);
    }, 100);
  }, []);

  return {
    hovered,
    mounted,
    visible,
    sliding,
    enter,
    leave,
    cancelLeave,
    refs,
    floatingStyles,
  };
}

// ── Panel component ────────────────────────────────────────────────────────

export function DocNodeTipPanel({
  hovered,
  visible,
  sliding,
  refs,
  floatingStyles,
  cancelLeave,
  leave,
}: {
  hovered: HoveredState;
  visible: boolean;
  sliding: boolean;
  refs: ReturnType<typeof useFloating>["refs"];
  floatingStyles: React.CSSProperties;
  cancelLeave: () => void;
  leave: () => void;
}) {
  const { t } = useTranslation();
  const { node } = hovered;
  const isFolder = node.type === "folder";

  return (
    <FloatingPortal>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: panel hover keeps it open */}
      <div
        ref={refs.setFloating}
        style={{
          ...floatingStyles,
          opacity: visible ? 1 : 0,
          transition: [
            "opacity 150ms ease",
            sliding ? "transform 200ms ease" : undefined,
          ]
            .filter(Boolean)
            .join(", "),
          backdropFilter: "blur(var(--window-blur, 24px))",
          WebkitBackdropFilter: "blur(var(--window-blur, 24px))",
          borderRadius: "var(--window-radius, 10px)",
        }}
        className="z-[9999] w-[260px] overflow-hidden border border-black/[0.06] p-3 shadow-xl bg-[rgba(255,255,255,calc(var(--window-opacity,85)/100))] dark:border-white/[0.08] dark:bg-[rgba(15,15,25,calc(var(--window-opacity,85)/100))]"
        onMouseEnter={cancelLeave}
        onMouseLeave={leave}
      >
        {/* Title row */}
        <div className="flex items-center gap-2">
          {isFolder ? (
            <Folder size={16} className="shrink-0 text-yellow-500" />
          ) : (
            <FileText size={16} className="shrink-0 text-[var(--accent)]" />
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg-primary">
            {node.icon ? `${node.icon} ` : ""}
            {node.title || t(untitledI18nKey(node.type))}
          </span>
        </div>

        {/* Metadata */}
        <div className="mt-2 flex flex-col gap-1 text-xs text-fg-muted">
          <div className="flex items-center justify-between">
            <span>修改时间</span>
            <span>{formatRelativeTime(node.updatedAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>创建时间</span>
            <span>{formatRelativeTime(node.createdAt)}</span>
          </div>
          {!isFolder && node.wordCount !== undefined && node.wordCount > 0 && (
            <div className="flex items-center justify-between">
              <span>字数</span>
              <span>{formatWordCount(node.wordCount)}</span>
            </div>
          )}
        </div>

        {/* Badges */}
        {!isFolder &&
          (node.isFavorite ||
            node.isPinned ||
            (node.tags && node.tags.length > 0)) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {node.isPinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  <Pin size={10} />
                  置顶
                </span>
              )}
              {node.isFavorite && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] text-red-500 dark:bg-red-900/30 dark:text-red-400">
                  <Heart size={10} />
                  收藏
                </span>
              )}
              {node.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-fill-secondary px-1.5 py-0.5 text-[10px] text-fg-muted"
                >
                  <Tag size={9} />
                  {tag}
                </span>
              ))}
            </div>
          )}
      </div>
    </FloatingPortal>
  );
}
