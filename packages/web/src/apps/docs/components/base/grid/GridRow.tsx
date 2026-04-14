import { cn } from "@tokiomo/components";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { BaseRecord, ColorRule, Field } from "../types";
import type { BaseEditorState } from "../useBaseEditor";
import { GridCell } from "./GridCell";
import { CHECKBOX_COL_WIDTH } from "./GridHeader";

function evaluateColorRules(
  rules: ColorRule[],
  record: BaseRecord,
): string | undefined {
  for (const rule of rules) {
    const val = record.data[rule.fieldId];
    const strVal = val == null ? "" : String(val);
    let match = false;
    switch (rule.operator) {
      case "eq":
        match = strVal === String(rule.value ?? "");
        break;
      case "neq":
        match = strVal !== String(rule.value ?? "");
        break;
      case "contains":
        match = strVal.includes(String(rule.value ?? ""));
        break;
      case "notContains":
        match = !strVal.includes(String(rule.value ?? ""));
        break;
      case "isEmpty":
        match = strVal === "";
        break;
      case "isNotEmpty":
        match = strVal !== "";
        break;
    }
    if (match) {
      return rule.color;
    }
  }
  return undefined;
}

interface GridRowProps {
  record: BaseRecord;
  fields: Field[];
  rowIndex: number;
  state: BaseEditorState;
  rowNumberWidth: number;
  rowHeightPx: number;
  colorRules?: ColorRule[];
}

export function GridRow({
  record,
  fields,
  rowIndex,
  state,
  rowNumberWidth,
  rowHeightPx,
  colorRules,
}: GridRowProps) {
  const [hovering, setHovering] = useState(false);
  const rowBg = useMemo(
    () => evaluateColorRules(colorRules ?? [], record),
    [colorRules, record],
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: table row
    <div
      className={cn(
        "flex border-b border-border-subtle transition-colors",
        hovering && "bg-fill-tertiary/50",
      )}
      style={{ height: rowHeightPx, backgroundColor: rowBg }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
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

      {/* Row number */}
      <div
        className="flex shrink-0 items-center justify-center border-r border-border-subtle text-xs text-fg-muted"
        style={{ width: rowNumberWidth }}
      >
        {hovering ? (
          <button
            type="button"
            className="cursor-pointer rounded p-0.5 text-red-400 hover:text-red-600"
            onClick={() => state.deleteRecord(record.id)}
            title="删除行"
          >
            <Trash2 size={12} />
          </button>
        ) : (
          rowIndex + 1
        )}
      </div>

      {/* Cells */}
      {fields.map((field) => (
        <div
          key={field.id}
          className="shrink-0 border-r border-border-subtle text-xs"
          style={{ width: field.width, minWidth: field.width }}
        >
          <GridCell
            recordId={record.id}
            field={field}
            value={record.data[field.id]}
            state={state}
          />
        </div>
      ))}

      {/* Spacer */}
      <div className="flex-1" />
    </div>
  );
}
