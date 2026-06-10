import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import { useRef } from "react";
import { BlockToolbar } from "../components/BlockToolbar";
import { useBlockDrag } from "../hooks/use-block-drag";

export function CodeBlockElement({ element, ...props }: PlateElementProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDragging, handleDragPointerDown } = useBlockDrag(containerRef);

  return (
    <PlateElement element={element} {...props} className="my-4">
      <div
        className={`group/block relative transition-opacity ${isDragging ? "opacity-50" : ""}`}
      >
        <div ref={containerRef} contentEditable={false}>
          <BlockToolbar
            isDragging={isDragging}
            onPointerDown={handleDragPointerDown}
          />
        </div>
        <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 font-mono text-sm text-zinc-100 dark:bg-zinc-900">
          <code>{props.children}</code>
        </pre>
      </div>
    </PlateElement>
  );
}
