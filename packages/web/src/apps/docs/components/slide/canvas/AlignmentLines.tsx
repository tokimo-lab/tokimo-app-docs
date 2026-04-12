import type { AlignmentLine } from "../hooks/use-alignment-lines";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "../types";

interface AlignmentLinesProps {
  lines: AlignmentLine[];
}

export function AlignmentLines({ lines }: AlignmentLinesProps) {
  if (lines.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-50"
      width={VIEWPORT_WIDTH}
      height={VIEWPORT_HEIGHT}
    >
      {lines.map((line) =>
        line.type === "vertical" ? (
          <line
            key={`v-${line.type}-${line.position}`}
            x1={line.position}
            y1={0}
            x2={line.position}
            y2={VIEWPORT_HEIGHT}
            stroke="#ff0000"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ) : (
          <line
            key={`h-${line.type}-${line.position}`}
            x1={0}
            y1={line.position}
            x2={VIEWPORT_WIDTH}
            y2={line.position}
            stroke="#ff0000"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ),
      )}
    </svg>
  );
}
