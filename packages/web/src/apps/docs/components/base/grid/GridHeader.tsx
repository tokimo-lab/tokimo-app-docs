import { cn } from "@tokiomo/components";
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  Hash,
  Link,
  List,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { FieldConfigPanel } from "../FieldConfigPanel";
import type { Field, FieldType } from "../types";

const CHECKBOX_COL_WIDTH = 40;
const ADD_COL_WIDTH = 40;

const FIELD_TYPE_ICON: Record<FieldType, React.ReactNode> = {
  text: <Type size={12} />,
  number: <Hash size={12} />,
  select: <ChevronDown size={12} />,
  multiSelect: <List size={12} />,
  checkbox: <CheckSquare size={12} />,
  date: <Calendar size={12} />,
  url: <Link size={12} />,
};

interface GridHeaderProps {
  fields: Field[];
  onResizeField: (fieldId: string, width: number) => void;
  onDeleteField: (fieldId: string) => void;
  onUpdateField: (fieldId: string, partial: Partial<Field>) => void;
  onAddField: (name: string, type: FieldType) => void;
  rowNumberWidth: number;
}

export function GridHeader({
  fields,
  onResizeField,
  onDeleteField,
  onUpdateField,
  onAddField,
  rowNumberWidth,
}: GridHeaderProps) {
  const [showAddField, setShowAddField] = useState(false);

  return (
    <div className="sticky top-0 z-10 flex h-9 border-b border-border-base bg-surface-secondary">
      {/* Checkbox column */}
      <div
        className="flex shrink-0 items-center justify-center border-r border-border-subtle"
        style={{ width: CHECKBOX_COL_WIDTH }}
      >
        <input
          type="checkbox"
          disabled
          className="h-3.5 w-3.5 rounded border-border-subtle"
        />
      </div>

      {/* Row number column */}
      <div
        className="flex shrink-0 items-center justify-center border-r border-border-subtle text-xs text-fg-muted"
        style={{ width: rowNumberWidth }}
      >
        #
      </div>

      {/* Field columns */}
      {fields.map((field) => (
        <HeaderCell
          key={field.id}
          field={field}
          onResize={(w) => onResizeField(field.id, w)}
          onDelete={() => onDeleteField(field.id)}
          onUpdate={(p) => onUpdateField(field.id, p)}
        />
      ))}

      {/* Add column button */}
      <div
        className="relative flex shrink-0 items-center justify-center border-r border-border-subtle"
        style={{ width: ADD_COL_WIDTH }}
      >
        <button
          type="button"
          className="flex h-full w-full cursor-pointer items-center justify-center text-fg-muted hover:bg-fill-tertiary"
          onClick={() => setShowAddField((v) => !v)}
          title="新增字段"
        >
          <Plus size={14} />
        </button>
        <FieldConfigPanel
          open={showAddField}
          onClose={() => setShowAddField(false)}
          onAddField={onAddField}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />
    </div>
  );
}

// ── Single header cell ──────────────────────────────────────────────────────

interface HeaderCellProps {
  field: Field;
  onResize: (width: number) => void;
  onDelete: () => void;
  onUpdate: (partial: Partial<Field>) => void;
}

function HeaderCell({ field, onResize, onDelete, onUpdate }: HeaderCellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(field.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = field.width;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        onResize(Math.max(60, startWidth + delta));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [field.width, onResize],
  );

  const commitRename = useCallback(() => {
    if (draft.trim()) onUpdate({ name: draft.trim() });
    setRenaming(false);
  }, [draft, onUpdate]);

  return (
    <div
      className="group relative flex shrink-0 items-center gap-1.5 border-r border-border-subtle px-2 text-xs font-medium text-fg-secondary"
      style={{ width: field.width, minWidth: field.width }}
    >
      {/* Field type icon */}
      <span className="shrink-0 text-fg-muted">
        {FIELD_TYPE_ICON[field.type]}
      </span>

      {renaming ? (
        <input
          ref={inputRef}
          className="w-full border-none bg-transparent text-xs font-medium outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setRenaming(false);
          }}
        />
      ) : (
        <span className="truncate">{field.name}</span>
      )}

      {/* Context menu button */}
      <button
        type="button"
        className={cn(
          "ml-auto hidden cursor-pointer rounded p-0.5 text-fg-muted hover:bg-fill-tertiary group-hover:block",
          menuOpen && "block",
        )}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <ChevronDown size={12} />
      </button>

      {menuOpen && (
        <>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: close dropdown */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute top-full right-0 z-50 mt-1 min-w-[140px] rounded border border-border-base bg-surface-base py-1 shadow-lg">
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
              onClick={() => {
                setRenaming(true);
                setDraft(field.name);
                setMenuOpen(false);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
            >
              重命名
            </button>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-fill-tertiary"
              onClick={() => {
                onDelete();
                setMenuOpen(false);
              }}
            >
              <Trash2 size={12} />
              删除字段
            </button>
          </div>
        </>
      )}

      {/* Resize handle */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: resize handle */}
      <div
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize opacity-0 hover:bg-blue-500 hover:opacity-100 group-hover:opacity-50"
        onMouseDown={startResize}
      />
    </div>
  );
}

export { ADD_COL_WIDTH, CHECKBOX_COL_WIDTH };
