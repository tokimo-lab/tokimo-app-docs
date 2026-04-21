import {
  autoUpdate,
  FloatingPortal,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  useTransitionStyles,
} from "@floating-ui/react";
import { FloatingVibrancy } from "@tokimo/ui";
import {
  Calendar,
  CheckSquare,
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
  Settings2,
  Star,
  Type,
  User,
  UserCheck,
  UserPen,
} from "lucide-react";
import { useState } from "react";
import type { Field, FieldType } from "../types";
import { FieldEditorPanel } from "./FieldEditorPanel";
import { FieldListPanel } from "./FieldListPanel";

// ── Shared constants ────────────────────────────────────────────────────────

export const FIELD_TYPES: FieldType[] = [
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

export const FIELD_TYPE_ICON: Record<FieldType, React.ReactNode> = {
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

// ── Props ───────────────────────────────────────────────────────────────────

interface FieldConfigPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: Field[];
  onAddField: (name: string, type: FieldType) => string;
  onUpdateField: (fieldId: string, partial: Partial<Field>) => void;
  onDeleteField: (fieldId: string) => void;
  hiddenFieldIds: string[];
  onToggleFieldVisibility: (fieldId: string) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export function FieldConfigPanel({
  open,
  onOpenChange,
  fields,
  onAddField,
  onUpdateField,
  onDeleteField,
  hiddenFieldIds,
  onToggleFieldVisibility,
}: FieldConfigPanelProps) {
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange,
    placement: "bottom-start",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    dismiss,
    role,
  ]);

  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: { open: 200, close: 150 },
    initial: { opacity: 0, transform: "scale(0.95) translateY(-4px)" },
    open: { opacity: 1, transform: "scale(1) translateY(0)" },
    close: { opacity: 0, transform: "scale(0.95) translateY(-4px)" },
  });

  // Reset editing state when panel closes
  if (!open && editingFieldId) setEditingFieldId(null);

  const editingField = editingFieldId
    ? (fields.find((f) => f.id === editingFieldId) ?? null)
    : null;

  const handleAddNew = () => {
    const newId = onAddField("新字段", "text");
    setEditingFieldId(newId);
  };

  const trigger = (
    <button
      type="button"
      ref={refs.setReference}
      className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
      onClick={() => onOpenChange(!open)}
      {...getReferenceProps()}
    >
      <Settings2 size={14} />
      字段配置
    </button>
  );

  return (
    <>
      {trigger}
      {isMounted && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="z-[9999]"
            {...getFloatingProps()}
          >
            <div style={transitionStyles} className="flex">
              {/* Left: field list */}
              <div
                className="w-[280px] overflow-hidden rounded-lg border border-black/[0.06] dark:border-white/[0.08] shadow-lg"
                style={{
                  backdropFilter: "blur(var(--window-blur, 24px))",
                  WebkitBackdropFilter: "blur(var(--window-blur, 24px))",
                  borderRadius: "var(--window-radius, 10px)",
                }}
              >
                <div className="relative bg-[rgba(255,255,255,calc(var(--window-opacity,85)/100))] dark:bg-[rgba(15,15,25,calc(var(--window-opacity,85)/100))]">
                  <FloatingVibrancy />
                  <div className="relative">
                    <FieldListPanel
                      fields={fields}
                      hiddenFieldIds={hiddenFieldIds}
                      onToggleFieldVisibility={onToggleFieldVisibility}
                      onEditField={(id) => setEditingFieldId(id)}
                      onDeleteField={onDeleteField}
                      onAddNew={handleAddNew}
                      activeFieldId={editingFieldId}
                    />
                  </div>
                </div>
              </div>

              {/* Right: field editor (slides out when editing) */}
              {editingField && (
                <div
                  className="ml-1 w-[280px] overflow-hidden rounded-lg border border-black/[0.06] dark:border-white/[0.08] shadow-lg"
                  style={{
                    backdropFilter: "blur(var(--window-blur, 24px))",
                    WebkitBackdropFilter: "blur(var(--window-blur, 24px))",
                    borderRadius: "var(--window-radius, 10px)",
                  }}
                >
                  <div className="relative bg-[rgba(255,255,255,calc(var(--window-opacity,85)/100))] dark:bg-[rgba(15,15,25,calc(var(--window-opacity,85)/100))]">
                    <FloatingVibrancy />
                    <div className="relative">
                      <FieldEditorPanel
                        field={editingField}
                        onUpdate={(partial) =>
                          onUpdateField(editingField.id, partial)
                        }
                        onBack={() => setEditingFieldId(null)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
