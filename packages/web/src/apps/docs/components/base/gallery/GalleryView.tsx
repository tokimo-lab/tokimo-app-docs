import { cn } from "@tokimo/ui";
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

interface DropTarget {
  index: number;
  side: "left" | "right";
}

export function GalleryView({ state }: GalleryViewProps) {
  const { processedRecords, activeView, fields } = state;
  const config = activeView?.galleryConfig;
  const cardSize = config?.cardSize ?? "medium";

  const [dragState, setDragState] = useState<DragInfo | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const dropTargetRef = useRef<DropTarget | null>(null);
  dropTargetRef.current = dropTarget;

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
      let target: DropTarget | null = null;
      for (const el of elements) {
        const rid = (el as HTMLElement).dataset?.galleryRecordId;
        if (rid && rid !== dragState.recordId) {
          const idx = processedRecords.findIndex((r) => r.id === rid);
          if (idx >= 0) {
            const rect = (el as HTMLElement).getBoundingClientRect();
            const midX = rect.left + rect.width / 2;
            target = {
              index: idx,
              side: e.clientX < midX ? "left" : "right",
            };
            break;
          }
        }
      }
      setDropTarget(target);
    };

    const handleUp = () => {
      const dt = dropTargetRef.current;
      if (dragState.isDragging && dt !== null) {
        const fromIdx = processedRecords.findIndex(
          (r) => r.id === dragState.recordId,
        );
        // Calculate actual insert index based on side
        let toIdx = dt.side === "right" ? dt.index + 1 : dt.index;
        // Adjust for removal of dragged item
        if (fromIdx < toIdx) toIdx--;
        if (fromIdx >= 0 && fromIdx !== toIdx) {
          const items = [...processedRecords];
          const [moved] = items.splice(fromIdx, 1);
          items.splice(toIdx, 0, moved);

          for (let i = 0; i < items.length; i++) {
            if (items[i].sortOrder !== i) {
              state.updateRecordSortOrder(items[i].id, i);
            }
          }
        }
      }
      setDragState(null);
      setDropTarget(null);
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
        {processedRecords.map((record, idx) => {
          const isDropLeft =
            dropTarget?.index === idx &&
            dropTarget.side === "left" &&
            dragState?.recordId !== record.id;
          const isDropRight =
            dropTarget?.index === idx &&
            dropTarget.side === "right" &&
            dragState?.recordId !== record.id;
          return (
            <div
              key={record.id}
              data-gallery-record-id={record.id}
              className={cn(
                "relative cursor-grab rounded-lg transition-opacity",
                dragState?.isDragging &&
                  dragState.recordId === record.id &&
                  "opacity-30",
              )}
              onPointerDown={(e) => handlePointerDown(record.id, e)}
            >
              {isDropLeft && (
                <div className="absolute top-0 -left-[3px] z-10 h-full w-[3px] rounded-full bg-[var(--accent-subtle)]0" />
              )}
              {isDropRight && (
                <div className="absolute top-0 -right-[3px] z-10 h-full w-[3px] rounded-full bg-[var(--accent-subtle)]0" />
              )}
              <GalleryCard record={record} state={state} />
            </div>
          );
        })}
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
            className="pointer-events-none fixed rounded-lg border border-[var(--accent)] bg-[var(--accent-subtle)] px-3 py-2 text-xs text-[var(--accent)] shadow-lg dark:bg-[var(--accent-subtle)] dark:text-[var(--accent-text)]"
            style={{ zIndex: 99999, left: 0, top: 0 }}
          >
            {dragRecordTitle}
          </div>,
          document.body,
        )}
    </div>
  );
}
