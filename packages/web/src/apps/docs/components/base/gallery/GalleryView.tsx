import { cn } from "@tokiomo/components";
import { useEffect } from "react";
import type { BaseEditorState } from "../useBaseEditor";
import { GalleryCard } from "./GalleryCard";

interface GalleryViewProps {
  state: BaseEditorState;
}

export function GalleryView({ state }: GalleryViewProps) {
  const { processedRecords, activeView, fields } = state;
  const config = activeView?.galleryConfig;
  const cardSize = config?.cardSize ?? "medium";

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
        {processedRecords.map((record) => (
          <GalleryCard key={record.id} record={record} state={state} />
        ))}
      </div>
      {processedRecords.length === 0 && (
        <div className="flex h-40 items-center justify-center text-sm text-fg-muted">
          暂无记录，点击工具栏「添加记录」新建
        </div>
      )}
    </div>
  );
}
