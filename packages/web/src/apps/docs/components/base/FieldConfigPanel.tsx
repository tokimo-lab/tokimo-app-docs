import { cn } from "@tokiomo/components";
import {
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Hash,
  Link,
  List,
  ListChecks,
  Type,
} from "lucide-react";
import { useState } from "react";
import type { FieldType } from "./types";
import { FIELD_TYPE_LABELS } from "./utils";

interface FieldConfigPanelProps {
  open: boolean;
  onClose: () => void;
  onAddField: (name: string, type: FieldType) => void;
}

const FIELD_TYPES: FieldType[] = [
  "text",
  "number",
  "select",
  "multiSelect",
  "checkbox",
  "date",
  "url",
];

const FIELD_TYPE_ICON: Record<FieldType, React.ReactNode> = {
  text: <Type size={14} />,
  number: <Hash size={14} />,
  select: <List size={14} />,
  multiSelect: <ListChecks size={14} />,
  checkbox: <CheckSquare size={14} />,
  date: <Calendar size={14} />,
  url: <Link size={14} />,
};

export function FieldConfigPanel({
  open,
  onClose,
  onAddField,
}: FieldConfigPanelProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [showTypePicker, setShowTypePicker] = useState(false);

  if (!open) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAddField(name.trim(), type);
    setName("");
    setType("text");
    setShowTypePicker(false);
    onClose();
  };

  const handleClose = () => {
    setShowTypePicker(false);
    onClose();
  };

  return (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay */}
      <div className="fixed inset-0 z-40" onClick={handleClose} />
      <div className="absolute top-full right-0 z-50 mt-1 w-64 rounded-lg border border-border-base bg-surface-base shadow-lg">
        {showTypePicker ? (
          /* Type picker sub-panel */
          <div className="p-3">
            <button
              type="button"
              className="mb-2 flex cursor-pointer items-center gap-1 text-xs text-fg-muted hover:text-fg-secondary"
              onClick={() => setShowTypePicker(false)}
            >
              <ChevronLeft size={14} />
              返回
            </button>
            <div className="text-xs font-medium text-fg-secondary mb-2">
              选择字段类型
            </div>
            <div className="flex flex-col gap-0.5">
              {FIELD_TYPES.map((ft) => (
                <button
                  key={ft}
                  type="button"
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                    type === ft
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-fg-secondary hover:bg-fill-tertiary",
                  )}
                  onClick={() => {
                    setType(ft);
                    setShowTypePicker(false);
                  }}
                >
                  <span className="shrink-0 text-fg-muted">
                    {FIELD_TYPE_ICON[ft]}
                  </span>
                  {FIELD_TYPE_LABELS[ft]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Main panel */
          <div className="p-3">
            <div className="mb-3 text-xs font-medium text-fg-secondary">
              新增字段
            </div>

            {/* Field name */}
            <div className="mb-1 text-xs text-fg-muted">标题</div>
            <input
              className="mb-3 w-full rounded border border-border-base bg-surface-secondary px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="输入字段名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />

            {/* Field type selector */}
            <div className="mb-1 text-xs text-fg-muted">字段类型</div>
            <button
              type="button"
              className="mb-3 flex w-full cursor-pointer items-center gap-2 rounded border border-border-base bg-surface-secondary px-2 py-1.5 text-sm hover:bg-fill-tertiary"
              onClick={() => setShowTypePicker(true)}
            >
              <span className="shrink-0 text-fg-muted">
                {FIELD_TYPE_ICON[type]}
              </span>
              <span className="flex-1 text-left">
                {FIELD_TYPE_LABELS[type]}
              </span>
              <ChevronRight size={14} className="text-fg-muted" />
            </button>

            {/* Action buttons */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="cursor-pointer rounded px-3 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
                onClick={handleClose}
              >
                取消
              </button>
              <button
                type="button"
                className="cursor-pointer rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                onClick={handleSubmit}
              >
                确定
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
