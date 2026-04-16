import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import { useRef } from "react";
import { BlockToolbar } from "../components/BlockToolbar";
import { useBlockDrag } from "../hooks/use-block-drag";

export function TableElement({ children, ...props }: PlateElementProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDragging, handleDragPointerDown } = useBlockDrag(containerRef);

  return (
    <PlateElement
      className={`group/block relative my-4 transition-opacity ${isDragging ? "opacity-50" : ""}`}
      {...props}
    >
      <div ref={containerRef} contentEditable={false}>
        <BlockToolbar
          isDragging={isDragging}
          onPointerDown={handleDragPointerDown}
        />
      </div>
      <table className="w-full border-collapse">{children}</table>
    </PlateElement>
  );
}

export function TableRowElement(props: PlateElementProps) {
  return <PlateElement as="tr" {...props} />;
}

export function TableCellElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="td"
      className="min-w-[80px] border border-border-base px-3 py-2 text-sm"
      {...props}
    />
  );
}

export function TableHeaderCellElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="th"
      className="min-w-[80px] border border-border-base bg-surface-base px-3 py-2 text-left text-sm font-semibold"
      {...props}
    />
  );
}
