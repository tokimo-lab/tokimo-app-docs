import { cn } from "@tokiomo/components";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { BaseRecord, Field } from "../types";
import type { BaseEditorState } from "../useBaseEditor";
import { GridCell } from "./GridCell";

interface GridRowProps {
  record: BaseRecord;
  fields: Field[];
  rowIndex: number;
  state: BaseEditorState;
  rowNumberWidth: number;
}

export function GridRow({
  record,
  fields,
  rowIndex,
  state,
  rowNumberWidth,
}: GridRowProps) {
  const [hovering, setHovering] = useState(false);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: table row
    <div
      className={cn(
        "flex border-b border-border-subtle transition-colors",
        hovering && "bg-fill-tertiary/50",
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
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
          className="shrink-0 border-r border-border-subtle"
          style={{ width: field.width, minWidth: field.width, height: 33 }}
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
