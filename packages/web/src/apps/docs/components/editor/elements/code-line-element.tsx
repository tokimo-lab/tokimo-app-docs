import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

export function CodeLineElement(props: PlateElementProps) {
  return <PlateElement {...props} className="py-px" />;
}
