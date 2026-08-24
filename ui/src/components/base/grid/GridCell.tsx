import { useCallback, useState } from "react";
import { CheckboxCell } from "../cells/CheckboxCell";
import { CurrencyCell } from "../cells/CurrencyCell";
import { DateCell } from "../cells/DateCell";
import { EmailCell } from "../cells/EmailCell";
import { MemberCell } from "../cells/MemberCell";
import { MultiSelectCell } from "../cells/MultiSelectCell";
import { NumberCell } from "../cells/NumberCell";
import { PhoneCell } from "../cells/PhoneCell";
import { ProgressCell } from "../cells/ProgressCell";
import { RatingCell } from "../cells/RatingCell";
import { ReadonlyCell } from "../cells/ReadonlyCell";
import { SelectCell } from "../cells/SelectCell";
import { TextCell } from "../cells/TextCell";
import { UrlCell } from "../cells/UrlCell";
import { WorkflowCell } from "../cells/WorkflowCell";
import type { CellValue, Field, SelectOption } from "../types";
import type { BaseEditorState } from "../useBaseEditor";

interface GridCellProps {
  recordId: string;
  field: Field;
  value: CellValue;
  state: BaseEditorState;
}

export function GridCell({ recordId, field, value, state }: GridCellProps) {
  const [editing, setEditing] = useState(false);

  const handleChange = useCallback(
    (v: CellValue) => state.updateCell(recordId, field.id, v),
    [recordId, field.id, state],
  );

  const handleAddOption = useCallback(
    (label: string): SelectOption | undefined =>
      state.addSelectOption(field.id, label),
    [field.id, state],
  );

  const startEdit = useCallback(() => setEditing(true), []);
  const endEdit = useCallback(() => setEditing(false), []);

  const cell = (() => {
    switch (field.type) {
    case "text":
      return (
        <TextCell
          value={value}
          onChange={handleChange}
          editing={editing}
          onStartEdit={startEdit}
          onEndEdit={endEdit}
        />
      );
    case "number":
      return (
        <NumberCell
          value={value}
          onChange={handleChange}
          editing={editing}
          onStartEdit={startEdit}
          onEndEdit={endEdit}
        />
      );
    case "checkbox":
      return <CheckboxCell value={value} onChange={handleChange} />;
    case "date":
      return (
        <DateCell
          value={value}
          onChange={handleChange}
          editing={editing}
          onStartEdit={startEdit}
          onEndEdit={endEdit}
        />
      );
    case "url":
      return (
        <UrlCell
          value={value}
          onChange={handleChange}
          editing={editing}
          onStartEdit={startEdit}
          onEndEdit={endEdit}
        />
      );
    case "select":
      return (
        <SelectCell
          value={value}
          options={field.options ?? []}
          onChange={handleChange}
          onAddOption={handleAddOption}
          editing={editing}
          onStartEdit={startEdit}
          onEndEdit={endEdit}
        />
      );
    case "multiSelect":
      return (
        <MultiSelectCell
          value={value}
          options={field.options ?? []}
          onChange={handleChange}
          onAddOption={handleAddOption}
          editing={editing}
          onStartEdit={startEdit}
          onEndEdit={endEdit}
        />
      );
    case "phone":
      return (
        <PhoneCell
          value={value}
          onChange={handleChange}
          editing={editing}
          onStartEdit={startEdit}
          onEndEdit={endEdit}
        />
      );
    case "email":
      return (
        <EmailCell
          value={value}
          onChange={handleChange}
          editing={editing}
          onStartEdit={startEdit}
          onEndEdit={endEdit}
        />
      );
    case "currency":
      return (
        <CurrencyCell
          value={value}
          onChange={handleChange}
          editing={editing}
          onStartEdit={startEdit}
          onEndEdit={endEdit}
        />
      );
    case "progress":
      return <ProgressCell value={value} onChange={handleChange} />;
    case "rating":
      return <RatingCell value={value} onChange={handleChange} />;
    case "workflow":
      return (
        <WorkflowCell
          value={value}
          options={field.options ?? []}
          onChange={handleChange}
          editing={editing}
          onStartEdit={startEdit}
          onEndEdit={endEdit}
        />
      );
    case "member":
      return (
        <MemberCell
          value={value}
          onChange={handleChange}
          editing={editing}
          onStartEdit={startEdit}
          onEndEdit={endEdit}
        />
      );
    case "attachment":
      return (
        <ReadonlyCell
          value={Array.isArray(value) ? `${value.length} 个文件` : ""}
        />
      );
    case "autoNumber":
    case "createdBy":
    case "modifiedBy":
    case "createdTime":
    case "modifiedTime":
      return <ReadonlyCell value={value} />;
    default:
      return <div className="px-2 leading-[32px]">{String(value ?? "")}</div>;
    }
  })();

  const canEnterEdit = ![
    "attachment",
    "autoNumber",
    "createdBy",
    "modifiedBy",
    "createdTime",
    "modifiedTime",
  ].includes(field.type);

  return (
    <div
      role="gridcell"
      aria-label={field.name}
      aria-readonly={!canEnterEdit}
      className="h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
      tabIndex={0}
      onDoubleClick={canEnterEdit ? startEdit : undefined}
      onKeyDown={(event) => {
        if (canEnterEdit && event.key === "Enter") {
          event.preventDefault();
          startEdit();
        }
      }}
    >
      {cell}
    </div>
  );
}
