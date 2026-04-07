import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

export function ParagraphElement(props: PlateElementProps) {
  return <PlateElement {...props} className="py-1 leading-7 text-fg-primary" />;
}
