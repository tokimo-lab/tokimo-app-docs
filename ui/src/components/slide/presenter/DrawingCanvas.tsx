import { useCallback, useRef, useState } from "react";

interface DrawingCanvasProps {
  active: boolean;
  slideIndex: number;
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
}

interface PathData {
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
}

const COLORS = [
  { value: "#ef4444", label: "Red" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#ffffff", label: "White" },
  { value: "#000000", label: "Black" },
];

const WIDTHS = [2, 4, 6];

export function DrawingCanvas({
  active,
  slideIndex,
  viewportWidth,
  viewportHeight,
  scale,
}: DrawingCanvasProps) {
  const drawingsRef = useRef<Map<number, PathData[]>>(new Map());
  const [currentPath, setCurrentPath] = useState<PathData | null>(null);
  const [color, setColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [, setRevision] = useState(0);
  const isDrawing = useRef(false);

  const getPaths = useCallback((): PathData[] => {
    return drawingsRef.current.get(slideIndex) ?? [];
  }, [slideIndex]);

  const toSvgCoords = useCallback(
    (e: React.PointerEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      return {
        x:
          ((e.clientX - rect.left) / scale) *
          (viewportWidth / (rect.width / scale)),
        y:
          ((e.clientY - rect.top) / scale) *
          (viewportHeight / (rect.height / scale)),
      };
    },
    [scale, viewportWidth, viewportHeight],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!active) return;
      e.preventDefault();
      e.stopPropagation();
      isDrawing.current = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const pt = toSvgCoords(e);
      setCurrentPath({ points: [pt], color, width: strokeWidth });
    },
    [active, color, strokeWidth, toSvgCoords],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing.current || !active) return;
      e.preventDefault();
      e.stopPropagation();
      const pt = toSvgCoords(e);
      setCurrentPath((prev) => {
        if (!prev) return prev;
        return { ...prev, points: [...prev.points, pt] };
      });
    },
    [active, toSvgCoords],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      e.stopPropagation();
      isDrawing.current = false;
      setCurrentPath((prev) => {
        if (prev && prev.points.length > 1) {
          const existing = drawingsRef.current.get(slideIndex) ?? [];
          drawingsRef.current.set(slideIndex, [...existing, prev]);
          setRevision((r) => r + 1);
        }
        return null;
      });
    },
    [slideIndex],
  );

  const clearAll = useCallback(() => {
    drawingsRef.current.set(slideIndex, []);
    setRevision((r) => r + 1);
  }, [slideIndex]);

  const pointsToString = (points: Array<{ x: number; y: number }>) =>
    points.map((p) => `${p.x},${p.y}`).join(" ");

  const paths = getPaths();

  return (
    <>
      <svg
        className="absolute left-0 top-0"
        width={viewportWidth}
        height={viewportHeight}
        viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
        style={{
          pointerEvents: active ? "auto" : "none",
          cursor: active ? "crosshair" : "default",
          zIndex: 40,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {paths.map((path, i) => (
          <polyline
            key={`${slideIndex}-${i}`}
            points={pointsToString(path.points)}
            stroke={path.color}
            strokeWidth={path.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {currentPath && (
          <polyline
            points={pointsToString(currentPath.points)}
            stroke={currentPath.color}
            strokeWidth={currentPath.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      {active && (
        <div
          className="absolute left-2 top-2 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 backdrop-blur-sm"
          style={{ zIndex: 45 }}
        >
          {COLORS.map((c) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: presenter drawing tool
            // biome-ignore lint/a11y/noStaticElementInteractions: presenter drawing tool
            <div
              key={c.value}
              className="cursor-pointer rounded-full"
              style={{
                width: 16,
                height: 16,
                backgroundColor: c.value,
                border:
                  color === c.value
                    ? "2px solid white"
                    : "2px solid transparent",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setColor(c.value);
              }}
            />
          ))}
          <div className="mx-1 h-4 w-px bg-white/30" />
          {WIDTHS.map((w) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: presenter drawing tool
            // biome-ignore lint/a11y/noStaticElementInteractions: presenter drawing tool
            <div
              key={w}
              className="cursor-pointer rounded-full bg-white"
              style={{
                width: w + 6,
                height: w + 6,
                opacity: strokeWidth === w ? 1 : 0.4,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setStrokeWidth(w);
              }}
            />
          ))}
          <div className="mx-1 h-4 w-px bg-white/30" />
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: presenter drawing tool */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: presenter drawing tool */}
          <div
            className="cursor-pointer text-xs text-white/80 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
          >
            ✕
          </div>
        </div>
      )}
    </>
  );
}
