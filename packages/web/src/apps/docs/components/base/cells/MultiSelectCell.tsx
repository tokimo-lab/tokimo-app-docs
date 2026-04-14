import { cn, Dropdown } from "@tokiomo/components";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CellValue, SelectOption } from "../types";

interface MultiSelectCellProps {
  value: CellValue;
  options: SelectOption[];
  onChange: (value: CellValue) => void;
  onAddOption: (label: string) => SelectOption | undefined;
  editing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
}

export function MultiSelectCell({
  value,
  options,
  onChange,
  onAddOption,
  editing,
  onStartEdit,
  onEndEdit,
}: MultiSelectCellProps) {
  const selectedIds = Array.isArray(value) ? value : [];
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing]);

  const handleToggle = useCallback(
    (optionId: string) => {
      const next = selectedIds.includes(optionId)
        ? selectedIds.filter((id) => id !== optionId)
        : [...selectedIds, optionId];
      onChange(next);
    },
    [selectedIds, onChange],
  );

  const handleRemove = useCallback(
    (optionId: string) => {
      onChange(selectedIds.filter((id) => id !== optionId));
    },
    [selectedIds, onChange],
  );

  const handleCreateOption = useCallback(() => {
    if (!search.trim()) return;
    const opt = onAddOption(search.trim());
    if (opt) {
      onChange([...selectedIds, opt.id]);
      setSearch("");
    }
  }, [search, onAddOption, selectedIds, onChange]);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedOptions = selectedIds
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is SelectOption => !!o);

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
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-fill-tertiary cursor-pointer",
                  selectedIds.includes(opt.id) && "bg-fill-secondary",
                )}
                onClick={() => handleToggle(opt.id)}
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: opt.color }}
                />
                {opt.label}
                {selectedIds.includes(opt.id) && (
                  <span className="ml-auto text-blue-600">✓</span>
                )}
              </button>
            ))}
            {search.trim() &&
              !filtered.some((o) => o.label === search.trim()) && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-blue-600 hover:bg-fill-tertiary cursor-pointer"
                  onClick={handleCreateOption}
                >
                  + 创建 "{search.trim()}"
                </button>
              )}
          </div>
        </div>
      )}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: grid cell double-click to edit */}
      <div className="h-full w-full cursor-pointer" onDoubleClick={onStartEdit}>
        {editing ? (
          <div className="flex min-h-[32px] flex-wrap items-center gap-1 px-1.5 ring-2 ring-blue-500 ring-inset">
            {selectedOptions.map((opt) => (
              <span
                key={opt.id}
                className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs"
                style={{ backgroundColor: opt.color }}
              >
                {opt.label}
                <button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => handleRemove(opt.id)}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              className="min-w-[60px] flex-1 border-none bg-transparent py-1 text-sm outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onEndEdit();
                if (e.key === "Enter" && search.trim()) {
                  if (
                    filtered.length > 0 &&
                    !filtered.some((o) => o.label === search.trim())
                  ) {
                    handleToggle(filtered[0].id);
                    setSearch("");
                  } else if (search.trim()) {
                    handleCreateOption();
                  }
                }
              }}
              placeholder="搜索或创建..."
            />
          </div>
        ) : (
          <div className="flex h-full w-full flex-wrap items-center gap-1 overflow-hidden px-2">
            {selectedOptions.map((opt) => (
              <span
                key={opt.id}
                className="inline-block truncate rounded-full px-2 py-0.5 text-xs"
                style={{ backgroundColor: opt.color }}
              >
                {opt.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </Dropdown>
  );
}
