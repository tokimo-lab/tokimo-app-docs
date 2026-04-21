import { cn } from "@tokimo/ui";
import { Eye, EyeOff, Lock, Plus } from "lucide-react";
import { useMemo } from "react";
import type { GalleryCardSize } from "../types";
import type { BaseEditorState } from "../useBaseEditor";
import { FIELD_TYPE_LABELS } from "../utils";

interface GalleryConfigPanelProps {
  state: BaseEditorState;
  onClose: () => void;
}

export function GalleryConfigPanel({
  state,
  onClose,
}: GalleryConfigPanelProps) {
  const { activeView, fields } = state;
  const config = activeView?.galleryConfig;

  const titleField = useMemo(
    () =>
      fields.find((f) => f.id === config?.titleFieldId) ??
      fields.find((f) => f.type === "text"),
    [fields, config?.titleFieldId],
  );

  const attachmentFields = useMemo(
    () => fields.filter((f) => f.type === "attachment"),
    [fields],
  );

  if (!config) return null;

  const visibleIds = new Set(config.cardVisibleFieldIds);
  const cardSizes: { value: GalleryCardSize; label: string }[] = [
    { value: "small", label: "小" },
    { value: "medium", label: "中" },
    { value: "large", label: "大" },
  ];

  return (
    <div
      className="w-72"
      style={{ animation: "toolbar-popup-in 150ms ease-out" }}
    >
      <div className="p-3">
        <div className="mb-3 text-xs font-medium text-fg-secondary">
          卡片配置
        </div>

        {/* Cover field */}
        <div className="mb-3">
          <div className="mb-1 text-xs text-fg-muted">封面图片</div>
          <select
            className="w-full cursor-pointer rounded border border-border-subtle bg-surface-base px-2 py-1 text-xs"
            value={config.coverFieldId}
            onChange={(e) =>
              state.setGalleryConfig({ coverFieldId: e.target.value })
            }
          >
            <option value="">无封面</option>
            {attachmentFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Card size */}
        <div className="mb-3">
          <div className="mb-1 text-xs text-fg-muted">卡片大小</div>
          <div className="flex gap-1">
            {cardSizes.map((s) => (
              <button
                key={s.value}
                type="button"
                className={cn(
                  "cursor-pointer rounded px-3 py-1 text-xs",
                  config.cardSize === s.value
                    ? "bg-[var(--accent-subtle)] text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent)]"
                    : "bg-fill-tertiary text-fg-muted hover:bg-fill-secondary",
                )}
                onClick={() => state.setGalleryConfig({ cardSize: s.value })}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Field visibility */}
        <div className="mb-1 text-xs text-fg-muted">展示字段</div>
        <div className="space-y-0.5">
          {fields.map((field) => {
            const isPrimary = field.id === titleField?.id;
            const isVisible = visibleIds.has(field.id);
            return (
              <div
                key={field.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-fill-tertiary"
              >
                <span className="flex-1 truncate">{field.name}</span>
                <span className="text-[10px] text-fg-muted">
                  {FIELD_TYPE_LABELS[field.type]}
                </span>
                {isPrimary ? (
                  <Lock size={12} className="shrink-0 text-fg-muted" />
                ) : (
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer"
                    onClick={() => state.toggleGalleryCardField(field.id)}
                  >
                    {isVisible ? (
                      <Eye size={12} className="text-fg-muted" />
                    ) : (
                      <EyeOff size={12} className="text-fg-muted opacity-40" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="mt-2 flex w-full cursor-pointer items-center gap-1 rounded px-2 py-1.5 text-xs text-[var(--accent)] hover:bg-fill-tertiary"
          onClick={() => state.addField("新字段", "text")}
        >
          <Plus size={12} />
          新增字段
        </button>
      </div>
    </div>
  );
}
