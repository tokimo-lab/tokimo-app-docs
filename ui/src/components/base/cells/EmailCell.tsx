import { useCallback, useEffect, useRef, useState } from "react";
import type { CellValue } from "../types";

interface EmailCellProps {
  value: CellValue;
  onChange: (value: CellValue) => void;
  editing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
}

export function EmailCell({
  value,
  onChange,
  editing,
  onStartEdit,
  onEndEdit,
}: EmailCellProps) {
  const [draft, setDraft] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(String(value ?? ""));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, value]);

  const commit = useCallback(() => {
    onChange(draft);
    onEndEdit();
  }, [draft, onChange, onEndEdit]);

  if (!editing) {
    const str = String(value ?? "");
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: grid cell double-click to edit
      <div
        className="h-full w-full cursor-pointer truncate px-2 leading-[32px]"
        onDoubleClick={onStartEdit}
      >
        {str ? (
          <a
            href={`mailto:${str}`}
            className="text-[var(--accent)] hover:underline dark:text-[var(--accent)]"
            onClick={(e) => e.stopPropagation()}
          >
            {str}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type="email"
      className="h-full w-full border-none bg-transparent px-2 text-sm outline-none ring-2 ring-[var(--accent)] ring-inset"
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
