import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

export function ColumnGroupElement(props: PlateElementProps) {
  return <PlateElement className="my-4 flex gap-4 rounded" {...props} />;
}

export function ColumnElement(props: PlateElementProps) {
  return (
    <PlateElement
      className="min-w-0 flex-1 rounded border border-dashed border-border-base p-3"
      {...props}
    />
  );
}
