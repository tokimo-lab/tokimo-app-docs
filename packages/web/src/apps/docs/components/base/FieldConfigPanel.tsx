import { cn } from "@tokiomo/components";
import {
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  GitBranch,
  Hash,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Mail,
  Paperclip,
  Percent,
  Phone,
  Star,
  Type,
  User,
  UserCheck,
  UserPen,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FieldType } from "./types";
import { FIELD_TYPE_LABELS } from "./utils";

interface FieldConfigPanelProps {
  open: boolean;
  onClose: () => void;
  onAddField: (name: string, type: FieldType) => void;
  /** ref to the trigger button — panel positions relative to it */
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const FIELD_TYPES: FieldType[] = [
  "text",
  "multiSelect",
  "select",
  "member",
  "date",
  "attachment",
  "number",
  "checkbox",
  "url",
  "workflow",
  "autoNumber",
  "phone",
  "email",
  "progress",
  "currency",
  "rating",
  "createdBy",
  "modifiedBy",
  "createdTime",
  "modifiedTime",
];

const FIELD_TYPE_ICON: Record<FieldType, React.ReactNode> = {
  text: <Type size={14} />,
  number: <Hash size={14} />,
  select: <List size={14} />,
  multiSelect: <ListChecks size={14} />,
  checkbox: <CheckSquare size={14} />,
  date: <Calendar size={14} />,
  url: <Link size={14} />,
  phone: <Phone size={14} />,
  email: <Mail size={14} />,
  currency: <DollarSign size={14} />,
  progress: <Percent size={14} />,
  rating: <Star size={14} />,
  workflow: <GitBranch size={14} />,
  attachment: <Paperclip size={14} />,
  member: <User size={14} />,
  autoNumber: <ListOrdered size={14} />,
  createdBy: <UserCheck size={14} />,
  modifiedBy: <UserPen size={14} />,
  createdTime: <Clock size={14} />,
  modifiedTime: <Clock size={14} />,
};

export function FieldConfigPanel({
  open,
  onClose,
  onAddField,
  triggerRef,
}: FieldConfigPanelProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !triggerRef?.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelWidth = 256;
    // Align panel's right edge with button's right edge
    let left = rect.right - panelWidth;
    // Ensure panel doesn't go off-screen left
    if (left < 8) left = 8;
    setPos({ top: rect.bottom + 4, left });
  }, [open, triggerRef]);

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

  const panelContent = (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay */}
      <div
        className={triggerRef ? "fixed inset-0" : "fixed inset-0 z-40"}
        style={triggerRef ? { zIndex: 9998 } : undefined}
        onClick={handleClose}
      />
      <div
        ref={panelRef}
        className={cn(
          "w-64 rounded-lg border border-border-base bg-surface-base shadow-lg",
          triggerRef ? "fixed" : "absolute top-full left-0 z-50 mt-1",
        )}
        style={
          triggerRef
            ? { top: pos.top, left: pos.left, zIndex: 9999 }
            : undefined
        }
      >
        {showTypePicker ? (
          <div className="p-3">
            <button
              type="button"
              className="mb-2 flex cursor-pointer items-center gap-1 text-xs text-fg-muted hover:text-fg-secondary"
              onClick={() => setShowTypePicker(false)}
            >
              <ChevronLeft size={14} />
              返回
            </button>
            <div className="mb-2 text-xs font-medium text-fg-secondary">
              选择字段类型
            </div>
            <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
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
          <div className="p-3">
            <div className="mb-3 text-xs font-medium text-fg-secondary">
              新增字段
            </div>
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

  // Use portal when triggerRef is provided (escapes overflow-hidden containers)
  if (triggerRef) {
    return createPortal(panelContent, document.body);
  }
  return panelContent;
}
