import { cn } from "@tokiomo/components";
import { Eye, EyeOff, Lock, Plus } from "lucide-react";
import { useMemo } from "react";
import type { BaseEditorState } from "../useBaseEditor";
import { FIELD_TYPE_LABELS } from "../utils";

interface CardConfigPanelProps {
  state: BaseEditorState;
  onClose: () => void;
}

export function CardConfigPanel({ state, onClose }: CardConfigPanelProps) {
  const { activeView, fields } = state;
  const config = activeView?.kanbanConfig;

  const primaryField = useMemo(
    () => fields.find((f) => f.type === "text"),
    [fields],
  );

  if (!config) return null;

  const visibleIds = new Set(config.cardVisibleFieldIds);

  return (
    <>
      <div
        className="relative z-50 w-72 rounded-lg border border-border-base bg-surface-base shadow-lg"
        style={{ animation: "toolbar-popup-in 150ms ease-out" }}
      >
        <div className="p-3">
          <div className="mb-3 text-xs font-medium text-fg-secondary">
            卡片配置
          </div>

          <div className="mb-3">
            <div className="mb-1 text-xs text-fg-muted">展示模式</div>
            <div className="flex gap-1">
              <button
                type="button"
                className={cn(
                  "cursor-pointer rounded px-3 py-1 text-xs",
                  config.cardDisplayMode === "normal"
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    : "bg-fill-tertiary text-fg-muted hover:bg-fill-secondary",
                )}
                onClick={() => state.setKanbanDisplayMode("normal")}
              >
                常规
              </button>
              <button
                type="button"
                className={cn(
                  "cursor-pointer rounded px-3 py-1 text-xs",
                  config.cardDisplayMode === "compact"
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    : "bg-fill-tertiary text-fg-muted hover:bg-fill-secondary",
                )}
                onClick={() => state.setKanbanDisplayMode("compact")}
              >
                紧凑
              </button>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-fg-muted">展示字段名</span>
            <button
              type="button"
              className={cn(
                "h-4 w-8 cursor-pointer rounded-full transition-colors",
                config.showFieldNames ? "bg-blue-500" : "bg-fill-tertiary",
              )}
              onClick={() =>
                state.setKanbanShowFieldNames(!config.showFieldNames)
              }
            >
              <div
                className={cn(
                  "h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
                  config.showFieldNames ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </button>
          </div>

          <div className="space-y-0.5">
            {fields.map((field) => {
              const isPrimary = field.id === primaryField?.id;
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
                      onClick={() => state.toggleKanbanCardField(field.id)}
                    >
                      {isVisible ? (
                        <Eye size={12} className="text-fg-muted" />
                      ) : (
                        <EyeOff
                          size={12}
                          className="text-fg-muted opacity-40"
                        />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="mt-2 flex w-full cursor-pointer items-center gap-1 rounded px-2 py-1.5 text-xs text-blue-600 hover:bg-fill-tertiary"
            onClick={() => {
              state.addField("新字段", "text");
            }}
          >
            <Plus size={12} />
            新增字段
          </button>
        </div>
      </div>
    </>
  );
}
