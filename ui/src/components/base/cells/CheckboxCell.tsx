import type { CellValue } from "../types";

interface CheckboxCellProps {
  value: CellValue;
  onChange: (value: CellValue) => void;
}

export function CheckboxCell({ value, onChange }: CheckboxCellProps) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  );
}
