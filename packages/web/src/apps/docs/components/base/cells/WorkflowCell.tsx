import { cn } from "@tokiomo/components";
import { useCallback, useEffect, useRef } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        onEndEdit();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editing, onEndEdit]);

  const selected = options.find((o) => o.id === value);

  const handleSelect = useCallback(
    (optId: string) => {
      onChange(optId);
      onEndEdit();
    },
    [onChange, onEndEdit],
  );

  if (!editing) {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: grid cell double-click to edit
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
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <div className="flex h-full items-center px-2">
        {selected?.label ?? "选择状态"}
      </div>
      <div className="absolute top-full left-0 z-50 mt-0.5 w-full rounded border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[rgba(38,38,58,0.88)] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
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
    </div>
  );
}
