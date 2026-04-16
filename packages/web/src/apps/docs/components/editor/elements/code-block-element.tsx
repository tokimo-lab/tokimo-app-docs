import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import { useRef } from "react";
import { BlockDragHandle } from "../components/BlockDragHandle";
import { useBlockDrag } from "../hooks/use-block-drag";

export function CodeBlockElement({ element, ...props }: PlateElementProps) {
  const lang = (element as Record<string, unknown>).lang as string | undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDragging, handleDragPointerDown } = useBlockDrag(containerRef);

  return (
    <PlateElement
      as="pre"
      element={element}
      {...props}
      className={`group relative my-4 overflow-x-auto rounded-lg bg-zinc-950 p-4 pt-8 font-mono text-sm text-zinc-100 transition-opacity dark:bg-zinc-900 ${isDragging ? "opacity-30" : ""}`}
    >
      <div
        ref={containerRef}
        contentEditable={false}
        className="absolute top-0 right-0 left-0"
      >
        <BlockDragHandle
          label={lang || "代码"}
          isDragging={isDragging}
          onPointerDown={handleDragPointerDown}
        />
      </div>
      <code>{props.children}</code>
    </PlateElement>
  );
}
