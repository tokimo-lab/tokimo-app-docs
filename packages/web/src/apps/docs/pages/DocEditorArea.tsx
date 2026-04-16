import { Spin } from "@tokiomo/components";
import { Paperclip } from "lucide-react";
import type { Value } from "platejs";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DocTagInput } from "@/apps/docs/components/DocTagInput";
import { DocEditor, type DocEditorHandle } from "@/apps/docs/components/editor";
import { useDocViewport } from "@/apps/docs/hooks/use-doc-viewport";
import {
  ScrollGuardContext,
  useScrollGuardProvider,
} from "@/apps/docs/hooks/use-scroll-guard";
import { untitledI18nKey } from "@/apps/docs/lib/doc-node";
import type { DocNodeOutput } from "@/generated/rust-api";
import { useAuth } from "@/system/auth/useAuth";

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
  doc: DocNodeOutput;
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
  onDropFiles?: (files: File[]) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [title, setTitle] = useState(doc.title);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);
  const [dragY, setDragY] = useState(0);
  const { scrollingRef, onScroll: onScrollGuard } = useScrollGuardProvider();

  // Viewport scroll persistence
  const {
    viewState: savedViewport,
    isLoading: viewportLoading,
    saveViewport,
  } = useDocViewport(readOnly ? undefined : doc.id);
  const viewportRestoredRef = useRef(false);

  // Sync title when doc changes
  const [prevId, setPrevId] = useState(doc.id);
  const [prevTitle, setPrevTitle] = useState(doc.title);
  if (doc.id !== prevId || doc.title !== prevTitle) {
    setPrevId(doc.id);
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
    onScrollGuard();
    if (!scrollRef.current) return;
    saveViewport({ scrollTop: scrollRef.current.scrollTop });
  }, [saveViewport, onScrollGuard]);

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
        if (scrollRef.current) {
          const rect = scrollRef.current.getBoundingClientRect();
          setDragY(e.clientY - rect.top + scrollRef.current.scrollTop);
        }
      }
    },
    [readOnly, onDropFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (readOnly || !onDropFiles) return;
      dragCounterRef.current = 0;
      setIsDraggingFile(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        onDropFiles(files);
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
        {/* Drag-drop overlay */}
        {isDraggingFile &&
          (() => {
            const scrollEl = scrollRef.current;
            const maxTop = scrollEl
              ? scrollEl.scrollTop + scrollEl.clientHeight - 200
              : Number.MAX_SAFE_INTEGER;
            const zoneTop = Math.max(0, Math.min(dragY - 100, maxTop));
            return (
              <div className="pointer-events-none absolute inset-0 z-50">
                <div
                  className="absolute right-4 left-4 rounded-xl border-2 border-dashed border-fill-brand bg-fill-brand-secondary/20"
                  style={{ top: zoneTop, height: 200 }}
                >
                  <div className="flex h-full items-center justify-center">
                    <div className="flex items-center gap-2 rounded-lg bg-surface-elevated px-4 py-3 shadow-lg">
                      <Paperclip size={18} className="text-fill-brand" />
                      <span className="text-sm font-medium text-fg-primary">
                        松开以添加附件
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
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
              nodeId={doc.id}
              spaceId={spaceId}
              tags={doc.tags}
              onChange={onTagsChange}
            />
          </div>
        )}

        {/* Plate editor */}
        <div className="flex-1">
          <DocEditor
            key={readOnly ? `preview-${doc.id}` : doc.id}
            value={doc.content as Value | null}
            onChange={readOnly ? () => {} : onContentChange}
            editorRef={readOnly ? undefined : editorRef}
            onAddComment={readOnly ? undefined : onAddComment}
            onOpenAi={readOnly ? undefined : onOpenAi}
            onAiAction={readOnly ? undefined : onAiAction}
            onInsertVfsFile={readOnly ? undefined : onInsertVfsFile}
            onAttachmentUpload={readOnly ? undefined : onAttachmentUpload}
            readOnly={readOnly}
            nodeId={readOnly ? undefined : doc.id}
            userName={user?.name}
          />
        </div>
      </div>
    </ScrollGuardContext>
  );
}
