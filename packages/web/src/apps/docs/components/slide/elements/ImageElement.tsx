import { useCallback } from "react";
import type { SlideImageElement } from "../types";

interface ImageElementProps {
  element: SlideImageElement;
  selected: boolean;
  onSelect: (id: string, append: boolean) => void;
}

export function ImageElement({
  element,
  selected,
  onSelect,
}: ImageElementProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(element.id, e.shiftKey);
    },
    [element.id, onSelect],
  );

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
        borderRadius: element.radius ? `${element.radius}px` : undefined,
        overflow: "hidden",
      }}
      onMouseDown={handleMouseDown}
      role="img"
    >
      <img
        src={element.src}
        alt=""
        className="pointer-events-none h-full w-full"
        style={{ objectFit: element.fixedRatio ? "contain" : "fill" }}
        draggable={false}
      />
    </div>
  );
}
