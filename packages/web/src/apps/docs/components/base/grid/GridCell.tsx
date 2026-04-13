import { useCallback, useState } from "react";
import { CheckboxCell } from "../cells/CheckboxCell";
import { DateCell } from "../cells/DateCell";
import { MultiSelectCell } from "../cells/MultiSelectCell";
import { NumberCell } from "../cells/NumberCell";
import { SelectCell } from "../cells/SelectCell";
import { TextCell } from "../cells/TextCell";
import { UrlCell } from "../cells/UrlCell";
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
    default:
      return <div className="px-2 leading-[32px]">{String(value ?? "")}</div>;
  }
}
