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
        className={`group/block relative transition-opacity ${isDragging ? "opacity-50" : ""}`}
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
                ? "border-[var(--accent)] dark:border-[var(--accent)]"
                : "border-border-base"
            }`}
          />
        </div>
      </div>
      {props.children}
    </PlateElement>
  );
}
