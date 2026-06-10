import { Star } from "lucide-react";
import { useCallback } from "react";
import type { CellValue } from "../types";

interface RatingCellProps {
  value: CellValue;
  onChange: (value: CellValue) => void;
}

export function RatingCell({ value, onChange }: RatingCellProps) {
  const num = typeof value === "number" ? value : 0;

  const handleClick = useCallback(
    (star: number) => {
      onChange(star === num ? 0 : star);
    },
    [num, onChange],
  );

  return (
    <div className="flex h-full items-center gap-0.5 px-2">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          className="cursor-pointer p-0.5 transition-transform hover:scale-110"
          onClick={() => handleClick(s)}
        >
          <Star
            size={14}
            className={
              s <= num ? "fill-yellow-400 text-yellow-400" : "text-fg-muted"
            }
          />
        </button>
      ))}
    </div>
  );
}
