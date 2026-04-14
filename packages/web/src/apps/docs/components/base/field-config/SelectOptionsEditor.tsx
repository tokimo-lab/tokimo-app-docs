import { cn } from "@tokiomo/components";
import { X } from "lucide-react";
import { useRef } from "react";
import type { SelectOption } from "../types";
import { SELECT_COLORS } from "../types";
import { generateId, nextSelectColor } from "../utils";

interface SelectOptionsEditorProps {
  options: SelectOption[];
  onChange: (options: SelectOption[]) => void;
  addLabel?: string;
}

export function SelectOptionsEditor({
  options,
  onChange,
  addLabel = "添加选项",
}: SelectOptionsEditorProps) {
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const handleAdd = () => {
    const color = nextSelectColor(options);
    const newOpt: SelectOption = {
      id: generateId("opt"),
      label: "",
      color,
    };
    onChange([...options, newOpt]);
    // Focus the new input after render
    requestAnimationFrame(() => {
      inputRefs.current.get(newOpt.id)?.focus();
    });
  };

  const handleDelete = (id: string) => {
    onChange(options.filter((o) => o.id !== id));
  };

  const handleLabelChange = (id: string, label: string) => {
    onChange(options.map((o) => (o.id === id ? { ...o, label } : o)));
  };

  const handleColorClick = (id: string) => {
    const opt = options.find((o) => o.id === id);
    if (!opt) return;
    const currentIdx = SELECT_COLORS.indexOf(
      opt.color as (typeof SELECT_COLORS)[number],
    );
    const nextIdx = (currentIdx + 1) % SELECT_COLORS.length;
    onChange(
      options.map((o) =>
        o.id === id ? { ...o, color: SELECT_COLORS[nextIdx] } : o,
      ),
    );
  };

  return (
    <div className="flex flex-col gap-1">
      {options.map((opt) => (
        <div key={opt.id} className="flex items-center gap-1.5">
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded-full"
            style={{
              width: 14,
              height: 14,
              backgroundColor: opt.color,
            }}
            onClick={() => handleColorClick(opt.id)}
            title="切换颜色"
          />
          <input
            ref={(el) => {
              if (el) inputRefs.current.set(opt.id, el);
              else inputRefs.current.delete(opt.id);
            }}
            className="min-w-0 flex-1 rounded border border-black/[0.06] dark:border-white/[0.08] bg-fill-tertiary dark:bg-white/[0.08] px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
            value={opt.label}
            onChange={(e) => handleLabelChange(opt.id, e.target.value)}
            placeholder="选项名称"
          />
          <button
            type="button"
            className={cn(
              "shrink-0 cursor-pointer rounded p-0.5 text-fg-muted hover:bg-fill-tertiary hover:text-red-500",
            )}
            onClick={() => handleDelete(opt.id)}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="mt-1 flex cursor-pointer items-center gap-1 rounded px-1 py-1 text-xs text-blue-600 hover:bg-fill-tertiary dark:text-blue-400"
        onClick={handleAdd}
      >
        + {addLabel}
      </button>
    </div>
  );
}
