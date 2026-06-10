import { cn, Dropdown } from "@tokimo/ui";
import { useCallback } from "react";
import type { CellValue, SelectOption } from "../types";

interface WorkflowCellProps {
  value: CellValue;
  options: SelectOption[];
  onChange: (value: CellValue) => void;
  editing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
}

export function WorkflowCell({
  value,
  options,
  onChange,
  editing,
  onStartEdit,
  onEndEdit,
}: WorkflowCellProps) {
  const selected = options.find((o) => o.id === value);

  const handleSelect = useCallback(
    (optId: string) => {
      onChange(optId);
      onEndEdit();
    },
    [onChange, onEndEdit],
  );

  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomLeft"
      open={editing}
      onOpenChange={(open) => {
        if (open) onStartEdit();
        else onEndEdit();
      }}
      dropdownRender={() => (
        <div className="w-48">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-fill-tertiary",
                opt.id === value && "bg-fill-secondary",
              )}
              onClick={() => handleSelect(opt.id)}
            >
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: opt.color }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: grid cell double-click to edit */}
      <div
        className="flex h-full w-full cursor-pointer items-center px-2"
        onDoubleClick={onStartEdit}
      >
        {selected ? (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-xs"
            style={{ backgroundColor: selected.color }}
          >
            {selected.label}
          </span>
        ) : (
          <span className="text-xs text-fg-muted">未开始</span>
        )}
      </div>
    </Dropdown>
  );
}
