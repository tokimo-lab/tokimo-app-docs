import { useCallback } from "react";
import type { SlideShapeElement } from "../types";

interface ShapeElementProps {
  element: SlideShapeElement;
  selected: boolean;
  onSelect: (id: string, append: boolean) => void;
}

export function ShapeElement({
  element,
  selected,
  onSelect,
}: ShapeElementProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(element.id, e.shiftKey);
    },
    [element.id, onSelect],
  );

  const [vw, vh] = element.viewBox;

  return (
    <div
      data-element-id={element.id}
      className="absolute"
      style={{
        left: element.left,
        top: element.top,
        width: element.width,
        height: element.height,
        transform: `rotate(${element.rotate}deg)`,
        opacity: element.opacity ?? 1,
        outline: selected ? "2px solid #4A90D9" : undefined,
        outlineOffset: 2,
        cursor: "move",
      }}
      onMouseDown={handleMouseDown}
      role="img"
    >
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        className="h-full w-full"
        preserveAspectRatio="none"
      >
        {element.gradient ? (
          <>
            <defs>
              {element.gradient.type === "linear" ? (
                <linearGradient
                  id={`grad-${element.id}`}
                  gradientTransform={`rotate(${element.gradient.angle ?? 0})`}
                >
                  {element.gradient.colors.map((c) => (
                    <stop
                      key={`${c.offset}-${c.color}`}
                      offset={`${c.offset * 100}%`}
                      stopColor={c.color}
                    />
                  ))}
                </linearGradient>
              ) : (
                <radialGradient id={`grad-${element.id}`}>
                  {element.gradient.colors.map((c) => (
                    <stop
                      key={`${c.offset}-${c.color}`}
                      offset={`${c.offset * 100}%`}
                      stopColor={c.color}
                    />
                  ))}
                </radialGradient>
              )}
            </defs>
            <path
              d={element.path}
              fill={`url(#grad-${element.id})`}
              stroke={element.outline?.color}
              strokeWidth={element.outline?.width}
              strokeDasharray={
                element.outline?.style === "dashed"
                  ? "8 4"
                  : element.outline?.style === "dotted"
                    ? "2 2"
                    : undefined
              }
            />
          </>
        ) : (
          <path
            d={element.path}
            fill={element.fill}
            stroke={element.outline?.color}
            strokeWidth={element.outline?.width}
            strokeDasharray={
              element.outline?.style === "dashed"
                ? "8 4"
                : element.outline?.style === "dotted"
                  ? "2 2"
                  : undefined
            }
          />
        )}
      </svg>
      {element.text && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{
            fontFamily: element.text.defaultFontName,
            color: element.text.defaultColor,
            textAlign: element.text.align,
          }}
        >
          {element.text.content}
        </div>
      )}
    </div>
  );
}
