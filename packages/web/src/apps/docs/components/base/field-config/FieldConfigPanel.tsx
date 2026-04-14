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
  Star,
  Type,
  User,
  UserCheck,
  UserPen,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  onClose: () => void;
  fields: Field[];
  onAddField: (name: string, type: FieldType) => string;
  onUpdateField: (fieldId: string, partial: Partial<Field>) => void;
  onDeleteField: (fieldId: string) => void;
  hiddenFieldIds: string[];
  onToggleFieldVisibility: (fieldId: string) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

// ── Component ───────────────────────────────────────────────────────────────

export function FieldConfigPanel({
  open,
  onClose,
  fields,
  onAddField,
  onUpdateField,
  onDeleteField,
  hiddenFieldIds,
  onToggleFieldVisibility,
  triggerRef,
}: FieldConfigPanelProps) {
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Position near trigger (or anchor placeholder)
  useEffect(() => {
    if (!open) return;
    const el = triggerRef?.current ?? anchorRef.current?.parentElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, [open, triggerRef]);

  // Close on click outside panel (without blocking toolbar buttons)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // Reset editing state when panel closes
  useEffect(() => {
    if (!open) setEditingFieldId(null);
  }, [open]);

  // Invisible anchor for position calculation when no triggerRef
  const anchor = !triggerRef ? (
    <div ref={anchorRef} className="absolute top-0 left-0 w-0 h-0" />
  ) : null;

  if (!open) return anchor;

  const editingField = editingFieldId
    ? (fields.find((f) => f.id === editingFieldId) ?? null)
    : null;

  const handleAddNew = () => {
    const newId = onAddField("新字段", "text");
    setEditingFieldId(newId);
  };

  const panelContent = (
    <div
      ref={panelRef}
      className="flex"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        animation: "toolbar-popup-in 150ms ease-out",
      }}
    >
      {/* Left: field list (always visible) */}
      <div className="w-[280px] rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[rgba(38,38,58,0.88)] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
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

      {/* Right: field editor (slides out when editing) */}
      {editingField && (
        <div className="ml-1 w-[280px] rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[rgba(38,38,58,0.88)] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <FieldEditorPanel
            field={editingField}
            onUpdate={(partial) => onUpdateField(editingField.id, partial)}
            onBack={() => setEditingFieldId(null)}
          />
        </div>
      )}
    </div>
  );

  return (
    <>
      {anchor}
      {createPortal(panelContent, document.body)}
    </>
  );
}
