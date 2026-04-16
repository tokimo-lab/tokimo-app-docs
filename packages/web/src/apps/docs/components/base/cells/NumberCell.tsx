import { useCallback, useEffect, useRef, useState } from "react";
import type { CellValue } from "../types";

interface NumberCellProps {
  value: CellValue;
  onChange: (value: CellValue) => void;
  editing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
}

export function NumberCell({
  value,
  onChange,
  editing,
  onStartEdit,
  onEndEdit,
}: NumberCellProps) {
  const [draft, setDraft] = useState(
    value !== null && value !== undefined ? String(value) : "",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value !== null && value !== undefined ? String(value) : "");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, value]);

  const commit = useCallback(() => {
    const num = draft === "" ? null : Number(draft);
    onChange(num !== null && Number.isNaN(num) ? null : num);
    onEndEdit();
  }, [draft, onChange, onEndEdit]);

  if (!editing) {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: grid cell double-click to edit
      <div
        className="h-full w-full truncate px-2 text-right leading-[32px] cursor-pointer"
        onDoubleClick={onStartEdit}
      >
        {value !== null && value !== undefined && value !== ""
          ? String(value)
          : ""}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type="number"
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
