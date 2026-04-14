import { useCallback, useEffect, useRef, useState } from "react";
import type { CellValue } from "../types";

interface MemberCellProps {
  value: CellValue;
  onChange: (value: CellValue) => void;
  editing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
}

export function MemberCell({
  value,
  onChange,
  editing,
  onStartEdit,
  onEndEdit,
}: MemberCellProps) {
  const arr = Array.isArray(value) ? value : [];
  const [draft, setDraft] = useState(arr.join(", "));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft((Array.isArray(value) ? value : []).join(", "));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, value]);

  const commit = useCallback(() => {
    const members = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onChange(members);
    onEndEdit();
  }, [draft, onChange, onEndEdit]);

  if (!editing) {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: grid cell double-click to edit
      <div
        className="h-full w-full cursor-pointer truncate px-2 leading-[32px]"
        onDoubleClick={onStartEdit}
      >
        {arr.join(", ")}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      className="h-full w-full border-none bg-transparent px-2 text-sm outline-none ring-2 ring-blue-500 ring-inset"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onEndEdit();
      }}
      placeholder="逗号分隔..."
    />
  );
}
