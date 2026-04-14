import { cn } from "@tokiomo/components";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BaseEditorState } from "../useBaseEditor";
import { GalleryCard } from "./GalleryCard";

interface GalleryViewProps {
  state: BaseEditorState;
}

interface DragInfo {
  recordId: string;
  startX: number;
  startY: number;
  isDragging: boolean;
}

export function GalleryView({ state }: GalleryViewProps) {
  const { processedRecords, activeView, fields } = state;
  const config = activeView?.galleryConfig;
  const cardSize = config?.cardSize ?? "medium";

  const [dragState, setDragState] = useState<DragInfo | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  dropIndexRef.current = dropIndex;

  // Auto-initialize galleryConfig for views created before gallery support
  useEffect(() => {
    if (activeView?.type === "gallery" && !activeView.galleryConfig) {
      const titleField = fields.find((f) => f.type === "text") ?? fields[0];
      const attachField = fields.find((f) => f.type === "attachment");
      state.setGalleryConfig({
        coverFieldId: attachField?.id ?? "",
        titleFieldId: titleField?.id ?? "",
        cardVisibleFieldIds: fields.map((f) => f.id),
        cardSize: "medium",
      });
    }
  }, [activeView, fields, state]);

  const handlePointerDown = useCallback(
    (recordId: string, e: React.PointerEvent) => {
      // Only handle left button
      if (e.button !== 0) return;
      e.preventDefault();
      setDragState({
        recordId,
        startX: e.clientX,
        startY: e.clientY,
        isDragging: false,
      });
    },
    [],
  );

  useEffect(() => {
    if (!dragState) return;

    const handleMove = (e: PointerEvent) => {
      const dx = Math.abs(e.clientX - dragState.startX);
      const dy = Math.abs(e.clientY - dragState.startY);

      if (!dragState.isDragging && dx + dy > 5) {
        setDragState((prev) => (prev ? { ...prev, isDragging: true } : null));
      }

      if (ghostRef.current) {
        ghostRef.current.style.left = `${e.clientX + 8}px`;
        ghostRef.current.style.top = `${e.clientY + 8}px`;
      }

      // Find drop target via elementsFromPoint (works through pointer-events: none layers)
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      let targetIdx: number | null = null;
      for (const el of elements) {
        const rid = (el as HTMLElement).dataset?.galleryRecordId;
        if (rid && rid !== dragState.recordId) {
          const idx = processedRecords.findIndex((r) => r.id === rid);
          if (idx >= 0) {
            targetIdx = idx;
            break;
          }
        }
      }
      setDropIndex(targetIdx);
    };

    const handleUp = () => {
      const currentDropIndex = dropIndexRef.current;
      if (dragState.isDragging && currentDropIndex !== null) {
        const fromIdx = processedRecords.findIndex(
          (r) => r.id === dragState.recordId,
        );
        if (fromIdx >= 0 && fromIdx !== currentDropIndex) {
          const items = [...processedRecords];
          const [moved] = items.splice(fromIdx, 1);
          items.splice(currentDropIndex, 0, moved);

          for (let i = 0; i < items.length; i++) {
            if (items[i].sortOrder !== i) {
              state.updateRecordSortOrder(items[i].id, i);
            }
          }
        }
      }
      setDragState(null);
      setDropIndex(null);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    return () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
    };
  }, [dragState, processedRecords, state]);

  const dragRecordTitle = dragState?.isDragging
    ? (() => {
        const rec = processedRecords.find((r) => r.id === dragState.recordId);
        const tf = fields.find((f) => f.type === "text");
        return tf && rec ? String(rec.data[tf.id] ?? "未命名") : "未命名";
      })()
    : null;

  return (
    <div className="h-full overflow-auto p-4">
      <div
        className={cn(
          "grid gap-4",
          cardSize === "small"
            ? "grid-cols-[repeat(auto-fill,minmax(180px,1fr))]"
            : cardSize === "large"
              ? "grid-cols-[repeat(auto-fill,minmax(300px,1fr))]"
              : "grid-cols-[repeat(auto-fill,minmax(240px,1fr))]",
        )}
      >
        {processedRecords.map((record, idx) => (
          <div
            key={record.id}
            data-gallery-record-id={record.id}
            className={cn(
              "cursor-grab rounded-lg transition-opacity",
              dragState?.isDragging &&
                dragState.recordId === record.id &&
                "opacity-30",
              dropIndex === idx &&
                dragState?.recordId !== record.id &&
                "ring-2 ring-blue-400 rounded-lg",
            )}
            onPointerDown={(e) => handlePointerDown(record.id, e)}
          >
            <GalleryCard record={record} state={state} />
          </div>
        ))}
      </div>
      {processedRecords.length === 0 && (
        <div className="flex h-40 items-center justify-center text-sm text-fg-muted">
          暂无记录，点击工具栏「添加记录」新建
        </div>
      )}

      {dragState?.isDragging &&
        dragRecordTitle &&
        createPortal(
          <div
            ref={ghostRef}
            className="pointer-events-none fixed rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-600 shadow-lg dark:bg-blue-900/40 dark:text-blue-300"
            style={{ zIndex: 99999, left: 0, top: 0 }}
          >
            {dragRecordTitle}
          </div>,
          document.body,
        )}
    </div>
  );
}
