import { useCallback } from "react";
import type { SlideLineElement } from "../types";

interface LineElementProps {
  element: SlideLineElement;
  selected: boolean;
  onSelect: (id: string, append: boolean) => void;
}

export function LineElement({ element, selected, onSelect }: LineElementProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(element.id, e.shiftKey);
    },
    [element.id, onSelect],
  );

  const [sx, sy] = element.start;
  const [ex, ey] = element.end;
  const minX = Math.min(sx, ex);
  const minY = Math.min(sy, ey);
  const w = Math.abs(ex - sx) || 1;
  const h = Math.abs(ey - sy) || 1;

  const dashArray =
    element.style === "dashed"
      ? "8 4"
      : element.style === "dotted"
        ? "2 2"
        : undefined;

  const markerId = `arrow-${element.id}`;

  return (
    <div
      data-element-id={element.id}
      className="absolute"
      style={{
        left: element.left + minX,
        top: element.top + minY,
        width: w,
        height: h,
        cursor: "move",
        opacity: element.opacity ?? 1,
      }}
      onMouseDown={handleMouseDown}
      role="img"
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full overflow-visible">
        <defs>
          {element.points[1] === "arrow" && (
            <marker
              id={markerId}
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill={element.color} />
            </marker>
          )}
        </defs>
        <line
          x1={sx - minX}
          y1={sy - minY}
          x2={ex - minX}
          y2={ey - minY}
          stroke={element.color}
          strokeWidth={selected ? 3 : 2}
          strokeDasharray={dashArray}
          markerEnd={
            element.points[1] === "arrow" ? `url(#${markerId})` : undefined
          }
        />
        {element.points[0] === "dot" && (
          <circle cx={sx - minX} cy={sy - minY} r={4} fill={element.color} />
        )}
        {element.points[1] === "dot" && (
          <circle cx={ex - minX} cy={ey - minY} r={4} fill={element.color} />
        )}
      </svg>
      {selected && (
        <div className="pointer-events-none absolute inset-0 border border-dashed border-blue-400" />
      )}
    </div>
  );
}
