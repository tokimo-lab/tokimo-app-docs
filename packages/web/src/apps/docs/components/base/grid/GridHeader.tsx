import { cn } from "@tokiomo/components";
import {
  ArrowDownZA,
  ArrowUpAZ,
  Calendar,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  DollarSign,
  Edit,
  FileText,
  Filter,
  GitBranch,
  Group,
  Hash,
  Link,
  List,
  Lock,
  Mail,
  Paintbrush,
  Phone,
  Plus,
  PlusCircle,
  Star,
  Trash2,
  TrendingUp,
  Type,
  User,
  UserPlus,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { FieldConfigPanel } from "../field-config";
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
  phone: <Phone size={12} />,
  email: <Mail size={12} />,
  currency: <DollarSign size={12} />,
  progress: <TrendingUp size={12} />,
  rating: <Star size={12} />,
  workflow: <GitBranch size={12} />,
  member: <UserPlus size={12} />,
  autoNumber: <Hash size={12} />,
  createdBy: <User size={12} />,
  modifiedBy: <User size={12} />,
  createdTime: <Clock size={12} />,
  modifiedTime: <Clock size={12} />,
  attachment: <Link size={12} />,
};

interface GridHeaderProps {
  fields: Field[];
  onResizeField: (fieldId: string, width: number) => void;
  onDeleteField: (fieldId: string) => void;
  onUpdateField: (fieldId: string, partial: Partial<Field>) => void;
  onAddField: (name: string, type: FieldType) => string;
  onDuplicateField: (fieldId: string) => void;
  onInsertFieldAfter: (
    afterFieldId: string,
    name: string,
    type: FieldType,
  ) => void;
  onSortField: (fieldId: string, direction: "asc" | "desc") => void;
  onFilterField: (fieldId: string) => void;
  onGroupField: (fieldId: string) => void;
  onFreezeUpTo: (fieldId: string) => void;
  hiddenFieldIds: string[];
  onToggleFieldVisibility: (fieldId: string) => void;
  rowNumberWidth: number;
  rowHeightPx?: number;
}

export function GridHeader({
  fields,
  onResizeField,
  onDeleteField,
  onUpdateField,
  onAddField,
  onDuplicateField,
  onInsertFieldAfter,
  onSortField,
  onFilterField,
  onGroupField,
  onFreezeUpTo,
  hiddenFieldIds,
  onToggleFieldVisibility,
  rowNumberWidth,
  rowHeightPx,
}: GridHeaderProps) {
  const [showAddField, setShowAddField] = useState(false);
  const addFieldBtnRef = useRef<HTMLButtonElement>(null);
  const headerHeight = Math.max(36, rowHeightPx ?? 36);

  return (
    <div
      className="sticky top-0 z-10 flex border-b border-border-base bg-surface-secondary"
      style={{ height: headerHeight }}
    >
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
          onDuplicate={() => onDuplicateField(field.id)}
          onInsertAfter={() => onInsertFieldAfter(field.id, "新字段", "text")}
          onSortAsc={() => onSortField(field.id, "asc")}
          onSortDesc={() => onSortField(field.id, "desc")}
          onFilter={() => onFilterField(field.id)}
          onGroup={() => onGroupField(field.id)}
          onFreeze={() => onFreezeUpTo(field.id)}
        />
      ))}

      {/* Add column button */}
      <div
        className="relative flex shrink-0 items-center justify-center border-r border-border-subtle"
        style={{ width: ADD_COL_WIDTH }}
      >
        <button
          ref={addFieldBtnRef}
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
          fields={fields}
          onAddField={onAddField}
          onUpdateField={(fid, p) => onUpdateField(fid, p)}
          onDeleteField={onDeleteField}
          hiddenFieldIds={hiddenFieldIds}
          onToggleFieldVisibility={onToggleFieldVisibility}
          triggerRef={addFieldBtnRef}
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
  onDuplicate: () => void;
  onInsertAfter: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onFilter: () => void;
  onGroup: () => void;
  onFreeze: () => void;
}

function HeaderCell({
  field,
  onResize,
  onDelete,
  onUpdate,
  onDuplicate,
  onInsertAfter,
  onSortAsc,
  onSortDesc,
  onFilter,
  onGroup,
  onFreeze,
}: HeaderCellProps) {
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

  const closeMenuAndRun = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

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
          <div className="absolute top-full right-0 z-50 mt-1 min-w-[180px] rounded border border-border-base bg-surface-base py-1 shadow-lg">
            {/* Group 1: Edit */}
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
              <Edit size={12} />
              修改字段/列
            </button>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
              onClick={() => setMenuOpen(false)}
            >
              <FileText size={12} />
              编辑字段/列描述
            </button>

            <div className="my-1 h-px bg-border-subtle" />

            {/* Group 2: Copy / Insert */}
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
              onClick={() => setMenuOpen(false)}
            >
              <Paintbrush size={12} />
              整列填色
            </button>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
              onClick={() => closeMenuAndRun(onDuplicate)}
            >
              <Copy size={12} />
              复制字段/列
            </button>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
              onClick={() => closeMenuAndRun(onInsertAfter)}
            >
              <PlusCircle size={12} />
              向右插入字段/列
            </button>

            <div className="my-1 h-px bg-border-subtle" />

            {/* Group 3: Freeze */}
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
              onClick={() => closeMenuAndRun(onFreeze)}
            >
              <Lock size={12} />
              冻结至此字段/列
            </button>

            <div className="my-1 h-px bg-border-subtle" />

            {/* Group 4: Sort / Group / Filter */}
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
              onClick={() => closeMenuAndRun(onSortAsc)}
            >
              <ArrowUpAZ size={12} />A → Z 排序
            </button>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
              onClick={() => closeMenuAndRun(onSortDesc)}
            >
              <ArrowDownZA size={12} />Z → A 排序
            </button>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
              onClick={() => closeMenuAndRun(onGroup)}
            >
              <Group size={12} />
              按「{field.name}」分组
            </button>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-fill-tertiary"
              onClick={() => closeMenuAndRun(onFilter)}
            >
              <Filter size={12} />
              按「{field.name}」筛选
            </button>

            <div className="my-1 h-px bg-border-subtle" />

            {/* Group 5: Delete */}
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-fill-tertiary"
              onClick={() => closeMenuAndRun(onDelete)}
            >
              <Trash2 size={12} />
              删除字段/列
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
