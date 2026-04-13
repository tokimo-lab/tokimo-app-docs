import { Spin } from "@tokiomo/components";
import type { Value } from "platejs";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DocTagInput } from "@/apps/docs/components/DocTagInput";
import { DocEditor, type DocEditorHandle } from "@/apps/docs/components/editor";
import { useDocViewport } from "@/apps/docs/hooks/use-doc-viewport";
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
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [title, setTitle] = useState(doc.title);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    if (!scrollRef.current) return;
    saveViewport({ scrollTop: scrollRef.current.scrollTop });
  }, [saveViewport]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin />
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex h-full flex-col overflow-y-auto"
      onScroll={handleScroll}
    >
      {/* Title input */}
      <div className="mx-auto w-full max-w-3xl px-6 pt-12 pb-2">
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
        <div className="mx-auto w-full max-w-3xl px-6 pb-2">
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
          readOnly={readOnly}
          nodeId={readOnly ? undefined : doc.id}
          userName={user?.name}
        />
      </div>
    </div>
  );
}
