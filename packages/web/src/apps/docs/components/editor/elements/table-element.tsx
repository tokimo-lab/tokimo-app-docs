import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import { useRef } from "react";
import { BlockDragHandle } from "../components/BlockDragHandle";
import { useBlockDrag } from "../hooks/use-block-drag";

export function TableElement({ children, ...props }: PlateElementProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDragging, handleDragPointerDown } = useBlockDrag(containerRef);

  return (
    <PlateElement
      className={`group relative my-4 transition-opacity ${isDragging ? "opacity-30" : ""}`}
      {...props}
    >
      <div
        ref={containerRef}
        contentEditable={false}
        className="absolute -top-1 right-0 left-0 z-10"
      >
        <BlockDragHandle
          label="表格"
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
