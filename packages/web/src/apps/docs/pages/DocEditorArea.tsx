import { Spin } from "@tokimo/ui";
import type { Value } from "platejs";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DocTagInput } from "@/apps/docs/components/DocTagInput";
import { DocEditor, type DocEditorHandle } from "@/apps/docs/components/editor";
import { useDocViewport } from "@/apps/docs/hooks/use-doc-viewport";
import {
  BlockFocusContext,
  ScrollGuardContext,
  useBlockFocusProvider,
  useScrollGuardProvider,
} from "@/apps/docs/hooks/use-scroll-guard";
import { untitledI18nKey } from "@/apps/docs/lib/doc-node";
import { useAuth } from "@/system/auth/useAuth";
import type { DocNodeDetail } from "./useDocsPage";

const PLACEHOLDER_HEIGHT = 120;
const PLACEHOLDER_ID = "doc-drag-placeholder";

/** Collect bounding rects of all direct children (slate blocks + placeholder). */
function snapshotPositions(editorEl: Element): Map<Element, DOMRect> {
  const map = new Map<Element, DOMRect>();
  for (const child of editorEl.children) {
    map.set(child, child.getBoundingClientRect());
  }
  return map;
}

/** FLIP-animate children that moved between two snapshots. */
function flipAnimate(editorEl: Element, before: Map<Element, DOMRect>): void {
  for (const child of editorEl.children) {
    const oldRect = before.get(child);
    if (!oldRect) continue;
    const newRect = child.getBoundingClientRect();
    const dy = oldRect.top - newRect.top;
    if (Math.abs(dy) < 1) continue;
    const el = child as HTMLElement;
    el.style.transition = "none";
    el.style.transform = `translateY(${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = "transform 200ms ease";
      el.style.transform = "";
      // Clean up after animation
      const cleanup = () => {
        el.style.transition = "";
        el.style.transform = "";
        el.removeEventListener("transitionend", cleanup);
      };
      el.addEventListener("transitionend", cleanup, { once: true });
    });
  }
}

/** Find the Slate block index closest to the given clientY. */
function findInsertIndex(clientY: number): number {
  const editorEl = document.querySelector("[data-slate-editor]");
  if (!editorEl) return -1;
  const blocks = editorEl.querySelectorAll(
    ":scope > [data-slate-node='element']",
  );
  if (blocks.length === 0) return 0;
  for (let i = 0; i < blocks.length; i++) {
    const rect = blocks[i].getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (clientY < mid) return i;
  }
  return blocks.length;
}

/** Ensure a placeholder DOM element exists inside the Slate editor at `index`. */
function upsertPlaceholder(index: number): void {
  const editorEl = document.querySelector("[data-slate-editor]");
  if (!editorEl) return;

  let ph = document.getElementById(PLACEHOLDER_ID);
  if (!ph) {
    ph = document.createElement("div");
    ph.id = PLACEHOLDER_ID;
    ph.setAttribute("contenteditable", "false");
    ph.style.height = `${PLACEHOLDER_HEIGHT}px`;
    ph.className =
      "rounded-xl border-2 border-dashed border-fill-brand bg-fill-brand-secondary/20 flex items-center justify-center pointer-events-none my-1";
    const badge = document.createElement("div");
    badge.className =
      "flex items-center gap-2 rounded-lg bg-surface-elevated px-4 py-3 shadow-lg";
    badge.innerHTML =
      '<span class="text-sm font-medium text-fg-primary">松开以添加附件</span>';
    ph.appendChild(badge);
  }

  // Snapshot positions before DOM mutation for FLIP animation
  const before = snapshotPositions(editorEl);

  const blocks = editorEl.querySelectorAll(
    ":scope > [data-slate-node='element']",
  );
  if (index >= blocks.length) {
    editorEl.appendChild(ph);
  } else {
    editorEl.insertBefore(ph, blocks[index]);
  }

  // FLIP: animate blocks that shifted due to placeholder move
  flipAnimate(editorEl, before);
}

/** Remove the placeholder from the DOM. */
function removePlaceholder(): void {
  document.getElementById(PLACEHOLDER_ID)?.remove();
}

/** Get the current placeholder index (count of slate blocks before it). */
function getPlaceholderIndex(): number {
  const ph = document.getElementById(PLACEHOLDER_ID);
  if (!ph) return -1;
  const editorEl = ph.parentElement;
  if (!editorEl) return -1;
  let idx = 0;
  let sibling = editorEl.firstElementChild;
  while (sibling && sibling !== ph) {
    if (sibling.getAttribute("data-slate-node") === "element") idx++;
    sibling = sibling.nextElementSibling;
  }
  return idx;
}

export function DocEditorArea({
  doc,
  spaceId,
  isLoading,
  onTitleChange,
  onContentChange,
  onTagsChange,
  editorRef,
  onAddComment,
  onOpenAi,
  onAiAction,
  onInsertVfsFile,
  onAttachmentUpload,
  onDropFiles,
  readOnly,
}: {
  doc: DocNodeDetail;
  spaceId: string;
  isLoading: boolean;
  onTitleChange: (title: string) => void;
  onContentChange: (value: Value) => void;
  onTagsChange: (tags: string[]) => void;
  editorRef?: MutableRefObject<DocEditorHandle | null>;
  onAddComment?: (commentKey: string) => void;
  onOpenAi?: () => void;
  onAiAction?: (actionId: string) => void;
  onInsertVfsFile?: () => void;
  onAttachmentUpload?: () => void;
  onDropFiles?: (files: File[], insertAt?: number) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [title, setTitle] = useState(doc.title);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);
  const dragIndexRef = useRef(-1);
  const { value: blockFocusValue } = useBlockFocusProvider(scrollRef);
  const { scrollingRef, onScrollGuard } = useScrollGuardProvider();

  // Viewport scroll persistence
  const {
    viewState: savedViewport,
    isLoading: viewportLoading,
    saveViewport,
  } = useDocViewport(
    readOnly ? undefined : spaceId,
    readOnly ? undefined : doc.relPath,
  );
  const viewportRestoredRef = useRef(false);

  // Sync title when doc changes
  const [prevId, setPrevId] = useState(doc.relPath);
  const [prevTitle, setPrevTitle] = useState(doc.title);
  if (doc.relPath !== prevId || doc.title !== prevTitle) {
    setPrevId(doc.relPath);
    setPrevTitle(doc.title);
    setTitle(doc.title);
  }

  // ── Restore scroll position after content renders ──────────────────
  useEffect(() => {
    if (viewportLoading || viewportRestoredRef.current || isLoading) return;
    viewportRestoredRef.current = true;

    const sv = savedViewport as { scrollTop?: number } | null;
    if (!sv?.scrollTop || !scrollRef.current) return;

    // Delay slightly to let Plate render content
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = sv.scrollTop as number;
      }
    });
  }, [viewportLoading, savedViewport, isLoading]);

  // ── Track scroll changes ───────────────────────────────────────────
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    onScrollGuard();
    saveViewport({ scrollTop: scrollRef.current.scrollTop });
  }, [saveViewport, onScrollGuard]);

  // ── Add transition to editor blocks while dragging ────────────────
  useEffect(() => {
    const editorEl = document.querySelector("[data-slate-editor]");
    if (!editorEl) return;
    if (isDraggingFile) {
      editorEl.classList.add("doc-drag-active");
    } else {
      editorEl.classList.remove("doc-drag-active");
      removePlaceholder();
    }
    return () => {
      editorEl.classList.remove("doc-drag-active");
    };
  }, [isDraggingFile]);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (readOnly || !onDropFiles) return;
      if (e.dataTransfer.types.includes("Files")) {
        e.preventDefault();
        dragCounterRef.current += 1;
        if (dragCounterRef.current === 1) {
          setIsDraggingFile(true);
        }
      }
    },
    [readOnly, onDropFiles],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (readOnly || !onDropFiles) return;
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDraggingFile(false);
        removePlaceholder();
        dragIndexRef.current = -1;
      }
    },
    [readOnly, onDropFiles],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (readOnly || !onDropFiles) return;
      if (e.dataTransfer.types.includes("Files")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        const idx = findInsertIndex(e.clientY);
        if (idx !== dragIndexRef.current) {
          dragIndexRef.current = idx;
          upsertPlaceholder(idx);
        }
      }
    },
    [readOnly, onDropFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (readOnly || !onDropFiles) return;
      dragCounterRef.current = 0;
      const insertAt = getPlaceholderIndex();
      removePlaceholder();
      setIsDraggingFile(false);
      dragIndexRef.current = -1;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        onDropFiles(files, insertAt >= 0 ? insertAt : undefined);
      }
    },
    [readOnly, onDropFiles],
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin />
      </div>
    );
  }

  return (
    <ScrollGuardContext value={scrollingRef}>
      <BlockFocusContext value={blockFocusValue}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: file drop target for attachment upload */}
        <div
          ref={scrollRef}
          role="presentation"
          className="relative flex h-full flex-col overflow-y-auto"
          onScroll={handleScroll}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOverCapture={handleDragOver}
          onDropCapture={handleDrop}
        >
          {/* Title input */}
          <div className="w-full pl-[28px] pr-3 pt-6 pb-2">
            <input
              type="text"
              value={title}
              readOnly={readOnly}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (!readOnly && title !== doc.title) {
                  onTitleChange(title);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-full border-none bg-transparent text-4xl font-bold text-fg-primary outline-none placeholder:text-fg-muted  "
              placeholder={t(untitledI18nKey(doc.type))}
            />
          </div>

          {/* Tags */}
          {!readOnly && (
            <div className="w-full pl-[22px] pr-3 pb-2">
              <DocTagInput
                spaceId={spaceId}
                relPath={doc.relPath}
                tags={doc.tags ?? []}
                onChange={onTagsChange}
              />
            </div>
          )}

          {/* Plate editor */}
          <div className="flex-1">
            <DocEditor
              key={readOnly ? `preview-${doc.relPath}` : doc.relPath}
              value={doc.content as Value | null}
              onChange={readOnly ? () => {} : onContentChange}
              editorRef={readOnly ? undefined : editorRef}
              onAddComment={readOnly ? undefined : onAddComment}
              onOpenAi={readOnly ? undefined : onOpenAi}
              onAiAction={readOnly ? undefined : onAiAction}
              onInsertVfsFile={readOnly ? undefined : onInsertVfsFile}
              onAttachmentUpload={readOnly ? undefined : onAttachmentUpload}
              readOnly={readOnly}
              spaceId={readOnly ? undefined : spaceId}
              relPath={readOnly ? undefined : doc.relPath}
              userName={user?.name}
            />
          </div>
        </div>
      </BlockFocusContext>
    </ScrollGuardContext>
  );
}
