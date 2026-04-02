import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

export function TableElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="table"
      className="my-4 w-full border-collapse"
      {...props}
    />
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
