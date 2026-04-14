import type { CellValue } from "../types";

interface ReadonlyCellProps {
  value: CellValue;
}

export function ReadonlyCell({ value }: ReadonlyCellProps) {
  return (
    <div className="h-full w-full truncate px-2 leading-[32px] text-fg-muted">
      {String(value ?? "")}
    </div>
  );
}
