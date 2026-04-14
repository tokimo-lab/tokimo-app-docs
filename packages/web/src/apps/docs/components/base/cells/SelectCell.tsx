import { cn } from "@tokiomo/components";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CellValue, SelectOption } from "../types";

interface SelectCellProps {
  value: CellValue;
  options: SelectOption[];
  onChange: (value: CellValue) => void;
  onAddOption: (label: string) => SelectOption | undefined;
  editing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
}

export function SelectCell({
  value,
  options,
  onChange,
  onAddOption,
  editing,
  onStartEdit,
  onEndEdit,
}: SelectCellProps) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing]);

  // Close on outside click
  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onEndEdit();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editing, onEndEdit]);

  const handleSelect = useCallback(
    (optionId: string) => {
      onChange(optionId);
      onEndEdit();
    },
    [onChange, onEndEdit],
  );

  const handleCreateOption = useCallback(() => {
    if (!search.trim()) return;
    const opt = onAddOption(search.trim());
    if (opt) {
      onChange(opt.id);
      onEndEdit();
    }
  }, [search, onAddOption, onChange, onEndEdit]);

  const selectedOption = options.find((o) => o.id === value);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  if (!editing) {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: grid cell double-click to edit
      <div
        className="flex h-full w-full items-center px-2 cursor-pointer"
        onDoubleClick={onStartEdit}
      >
        {selectedOption && (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-xs"
            style={{ backgroundColor: selectedOption.color }}
          >
            {selectedOption.label}
          </span>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <input
        ref={inputRef}
        className="h-full w-full border-none bg-transparent px-2 text-sm outline-none ring-2 ring-blue-500 ring-inset"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onEndEdit();
          if (e.key === "Enter" && filtered.length > 0)
            handleSelect(filtered[0].id);
          else if (e.key === "Enter" && search.trim()) handleCreateOption();
        }}
        placeholder="搜索或创建..."
      />
      <div className="absolute top-full left-0 z-50 mt-0.5 max-h-48 w-full overflow-y-auto rounded border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[rgba(38,38,58,0.88)] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        {filtered.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-fill-tertiary cursor-pointer",
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
        {search.trim() && !filtered.some((o) => o.label === search.trim()) && (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-blue-600 hover:bg-fill-tertiary cursor-pointer"
            onClick={handleCreateOption}
          >
            + 创建 "{search.trim()}"
          </button>
        )}
        {filtered.length === 0 && !search.trim() && (
          <div className="px-2 py-2 text-center text-xs text-fg-muted">
            暂无选项
          </div>
        )}
      </div>
    </div>
  );
}
