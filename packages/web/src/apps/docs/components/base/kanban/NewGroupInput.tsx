import { Plus } from "lucide-react";
import { useState } from "react";
import { SELECT_COLORS } from "../types";

interface NewGroupInputProps {
  onAdd: (label: string, color: string) => void;
}

export function NewGroupInput({ onAdd }: NewGroupInputProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<string>(SELECT_COLORS[0]);

  const handleSubmit = () => {
    if (!label.trim()) return;
    onAdd(label.trim(), color);
    setLabel("");
    setColor(SELECT_COLORS[0]);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex h-fit w-[280px] shrink-0 flex-col rounded-lg bg-fill-quaternary p-2 dark:bg-surface-secondary">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded px-2 py-2 text-xs text-fg-muted hover:bg-fill-tertiary"
          onClick={() => setEditing(true)}
        >
          <Plus size={14} />
          新建分组
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-fit w-[280px] shrink-0 flex-col rounded-lg bg-fill-quaternary p-3 dark:bg-surface-secondary">
      <input
        className="mb-2 w-full rounded border border-border-base bg-surface-base px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="请输入标题"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") setEditing(false);
        }}
        // biome-ignore lint/a11y/noAutofocus: intentional focus on new input
        autoFocus
      />
      <div className="mb-2 flex flex-wrap gap-1">
        {SELECT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`h-5 w-5 cursor-pointer rounded-full border-2 transition-all ${color === c ? "scale-110 border-blue-500" : "border-transparent hover:scale-105"}`}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="cursor-pointer rounded px-3 py-1 text-xs text-fg-muted hover:bg-fill-tertiary"
          onClick={() => setEditing(false)}
        >
          取消
        </button>
        <button
          type="button"
          className="cursor-pointer rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
          onClick={handleSubmit}
        >
          确定
        </button>
      </div>
    </div>
  );
}
