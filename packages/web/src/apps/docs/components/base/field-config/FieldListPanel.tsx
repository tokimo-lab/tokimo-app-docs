import { cn } from "@tokiomo/components";
import { Eye, EyeOff, Lock, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import type { Field } from "../types";
import { FIELD_TYPE_ICON } from "./FieldConfigPanel";

interface FieldListPanelProps {
  fields: Field[];
  hiddenFieldIds: string[];
  onToggleFieldVisibility: (fieldId: string) => void;
  onEditField: (fieldId: string) => void;
  onDeleteField: (fieldId: string) => void;
  onAddNew: () => void;
  activeFieldId?: string | null;
}

export function FieldListPanel({
  fields,
  hiddenFieldIds,
  onToggleFieldVisibility,
  onEditField,
  onDeleteField,
  onAddNew,
  activeFieldId,
}: FieldListPanelProps) {
  const [menuFieldId, setMenuFieldId] = useState<string | null>(null);

  return (
    <div className="flex flex-col">
      <div className="px-3 pt-3 pb-2 text-xs font-medium text-fg-secondary">
        字段配置
      </div>

      {/* Scrollable field list */}
      <div className="max-h-[400px] flex-1 overflow-y-auto px-1">
        {fields.map((field, idx) => {
          const isFirst = idx === 0;
          const isHidden = hiddenFieldIds.includes(field.id);
          const isActive = field.id === activeFieldId;

          return (
            <div key={field.id} className="relative">
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: field row */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: field row */}
              <div
                className={cn(
                  "group flex h-8 cursor-pointer items-center gap-2 rounded px-2 text-xs hover:bg-fill-tertiary",
                  isHidden && "opacity-50",
                  isActive && "bg-fill-tertiary",
                )}
                onClick={() => onEditField(field.id)}
              >
                <span className="shrink-0 text-fg-muted">
                  {FIELD_TYPE_ICON[field.type]}
                </span>
                <span className="min-w-0 flex-1 truncate text-fg-secondary">
                  {field.name}
                </span>

                {/* Visibility toggle */}
                <button
                  type="button"
                  className="shrink-0 cursor-pointer rounded p-0.5 text-fg-muted hover:bg-fill-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFieldVisibility(field.id);
                  }}
                  title={isHidden ? "显示字段" : "隐藏字段"}
                >
                  {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>

                {/* Primary field lock or menu button */}
                {isFirst ? (
                  <span className="shrink-0 p-0.5 text-fg-muted" title="主字段">
                    <Lock size={14} />
                  </span>
                ) : (
                  <button
                    type="button"
                    className={cn(
                      "shrink-0 cursor-pointer rounded p-0.5 text-fg-muted hover:bg-fill-secondary",
                      menuFieldId !== field.id &&
                        "opacity-0 group-hover:opacity-100",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuFieldId(
                        menuFieldId === field.id ? null : field.id,
                      );
                    }}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                )}
              </div>

              {/* Context menu */}
              {menuFieldId === field.id && (
                <>
                  {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay */}
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay */}
                  <div
                    className="fixed inset-0"
                    style={{ zIndex: 1 }}
                    onClick={() => setMenuFieldId(null)}
                  />
                  <div
                    className="absolute top-full right-2 min-w-[100px] rounded border border-border-base bg-surface-base py-1 shadow-lg"
                    style={{ zIndex: 2 }}
                  >
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
                      onClick={() => {
                        setMenuFieldId(null);
                        onEditField(field.id);
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-xs text-red-600 hover:bg-fill-tertiary"
                      onClick={() => {
                        setMenuFieldId(null);
                        onDeleteField(field.id);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Add field button */}
      <div className="border-t border-border-subtle px-2 py-2">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-xs text-blue-600 hover:bg-fill-tertiary dark:text-blue-400"
          onClick={onAddNew}
        >
          <Plus size={14} />
          新增字段
        </button>
      </div>
    </div>
  );
}
