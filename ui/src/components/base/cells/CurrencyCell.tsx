import { useCallback, useEffect, useRef, useState } from "react";
import type { CellValue } from "../types";

interface CurrencyCellProps {
  value: CellValue;
  onChange: (value: CellValue) => void;
  editing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
}

export function CurrencyCell({
  value,
  onChange,
  editing,
  onStartEdit,
  onEndEdit,
}: CurrencyCellProps) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value != null ? String(value) : "");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, value]);

  const commit = useCallback(() => {
    const num = Number.parseFloat(draft);
    onChange(Number.isNaN(num) ? null : num);
    onEndEdit();
  }, [draft, onChange, onEndEdit]);

  if (!editing) {
    const display = typeof value === "number" ? `¥${value.toFixed(2)}` : "";
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: grid cell double-click to edit
      <div
        className="h-full w-full cursor-pointer truncate px-2 text-right leading-[32px]"
        onDoubleClick={onStartEdit}
      >
        {display}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      className="h-full w-full border-none bg-transparent px-2 text-right text-sm outline-none ring-2 ring-[var(--accent)] ring-inset"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onEndEdit();
      }}
    />
  );
}
