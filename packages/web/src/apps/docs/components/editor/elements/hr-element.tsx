import type { PlateElementProps } from "platejs/react";
import { PlateElement, useSelected } from "platejs/react";
import { useRef } from "react";
import { BlockDragHandle } from "../components/BlockDragHandle";
import { useBlockDrag } from "../hooks/use-block-drag";

export function HrElement(props: PlateElementProps) {
  const selected = useSelected();
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDragging, handleDragPointerDown } = useBlockDrag(containerRef);

  return (
    <PlateElement {...props}>
      <div
        ref={containerRef}
        contentEditable={false}
        className={`group relative transition-opacity ${isDragging ? "opacity-30" : ""}`}
      >
        <BlockDragHandle
          label="分隔线"
          isDragging={isDragging}
          onPointerDown={handleDragPointerDown}
        />
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
