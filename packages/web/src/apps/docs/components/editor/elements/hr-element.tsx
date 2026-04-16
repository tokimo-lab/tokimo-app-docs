import type { PlateElementProps } from "platejs/react";
import { PlateElement, useSelected } from "platejs/react";
import { useRef } from "react";
import { BlockToolbar } from "../components/BlockToolbar";
import { useBlockDrag } from "../hooks/use-block-drag";

export function HrElement(props: PlateElementProps) {
  const selected = useSelected();
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDragging, handleDragPointerDown } = useBlockDrag(containerRef);

  return (
    <PlateElement {...props}>
      <div
        contentEditable={false}
        className={`group/block relative transition-opacity ${isDragging ? "opacity-30" : ""}`}
      >
        <div ref={containerRef}>
          <BlockToolbar
            isDragging={isDragging}
            onPointerDown={handleDragPointerDown}
          />
        </div>
        <div className="py-4">
          <hr
            className={`border-t transition-colors ${
              selected
                ? "border-blue-500 dark:border-blue-400"
                : "border-border-base"
            }`}
          />
        </div>
      </div>
      {props.children}
    </PlateElement>
  );
}
