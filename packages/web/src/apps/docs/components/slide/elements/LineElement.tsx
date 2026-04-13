import { useCallback, useMemo } from "react";
import type { SlideLineElement } from "../types";

interface LineElementProps {
  element: SlideLineElement;
  selected: boolean;
  onSelect: (id: string, append: boolean) => void;
}

export function LineElement({ element, selected, onSelect }: LineElementProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      onSelect(element.id, e.shiftKey);
    },
    [element.id, onSelect],
  );

  const lineType = element.lineType ?? "straight";
  const controlPoints = element.controlPoints ?? [];

  const [sx, sy] = element.start;
  const [ex, ey] = element.end;

  const allPoints: [number, number][] = useMemo(
    () => [[sx, sy], ...controlPoints, [ex, ey]],
    [sx, sy, ex, ey, controlPoints],
  );

  const minX = Math.min(...allPoints.map((p) => p[0]));
  const minY = Math.min(...allPoints.map((p) => p[1]));
  const maxX = Math.max(...allPoints.map((p) => p[0]));
  const maxY = Math.max(...allPoints.map((p) => p[1]));
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;

  const dashArray =
    element.style === "dashed"
      ? "8 4"
      : element.style === "dotted"
        ? "2 2"
        : undefined;

  const markerId = `arrow-${element.id}`;
  const markerStartId = `arrow-start-${element.id}`;

  const lsx = sx - minX;
  const lsy = sy - minY;
  const lex = ex - minX;
  const ley = ey - minY;

  const renderPath = () => {
    const commonProps = {
      stroke: element.color,
      strokeWidth: element.strokeWidth ?? 2,
      strokeDasharray: dashArray,
      fill: "none" as const,
      markerStart:
        element.points[0] === "arrow" ? `url(#${markerStartId})` : undefined,
      markerEnd:
        element.points[1] === "arrow" ? `url(#${markerId})` : undefined,
    };

    if (lineType === "polyline" && controlPoints.length > 0) {
      const pts = allPoints
        .map((p) => `${p[0] - minX},${p[1] - minY}`)
        .join(" ");
      return <polyline points={pts} {...commonProps} />;
    }

    if (lineType === "curve") {
      if (controlPoints.length === 0) {
        return <line x1={lsx} y1={lsy} x2={lex} y2={ley} {...commonProps} />;
      }
      if (controlPoints.length === 1) {
        const [cx, cy] = controlPoints[0];
        const d = `M${lsx},${lsy} Q${cx - minX},${cy - minY} ${lex},${ley}`;
        return <path d={d} {...commonProps} />;
      }
      const [c1x, c1y] = controlPoints[0];
      const [c2x, c2y] = controlPoints[1];
      const d = `M${lsx},${lsy} C${c1x - minX},${c1y - minY} ${c2x - minX},${c2y - minY} ${lex},${ley}`;
      return <path d={d} {...commonProps} />;
    }

    // straight (default)
    return <line x1={lsx} y1={lsy} x2={lex} y2={ley} {...commonProps} />;
  };

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
          {element.points[0] === "arrow" && (
            <marker
              id={markerStartId}
              markerWidth="10"
              markerHeight="7"
              refX="0"
              refY="3.5"
              orient="auto"
            >
              <polygon points="10 0, 0 3.5, 10 7" fill={element.color} />
            </marker>
          )}
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
        {renderPath()}
        {element.points[0] === "dot" && (
          <circle cx={lsx} cy={lsy} r={4} fill={element.color} />
        )}
        {element.points[1] === "dot" && (
          <circle cx={lex} cy={ley} r={4} fill={element.color} />
        )}
      </svg>
      {selected && (
        <>
          <div className="pointer-events-none absolute inset-0 border border-dashed border-blue-400" />
          {controlPoints.map((cp, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: control points identified by index
              key={i}
              className="pointer-events-none absolute h-2.5 w-2.5 rounded-full border border-blue-500 bg-white"
              style={{
                left: cp[0] - minX - 5,
                top: cp[1] - minY - 5,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
