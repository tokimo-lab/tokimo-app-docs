import { useCallback } from "react";
import type { CellValue } from "../types";

interface ProgressCellProps {
  value: CellValue;
  onChange: (value: CellValue) => void;
}

export function ProgressCell({ value, onChange }: ProgressCellProps) {
  const num = typeof value === "number" ? Math.min(100, Math.max(0, value)) : 0;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
      onChange(Math.min(100, Math.max(0, pct)));
    },
    [onChange],
  );

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: progress bar click
    // biome-ignore lint/a11y/noStaticElementInteractions: progress bar click
    <div
      className="flex h-full w-full cursor-pointer items-center gap-2 px-2"
      onClick={handleClick}
    >
      <div className="h-1.5 flex-1 rounded-full bg-fill-tertiary">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${num}%` }}
        />
      </div>
      <span className="shrink-0 text-xs text-fg-muted">{num}%</span>
    </div>
  );
}
