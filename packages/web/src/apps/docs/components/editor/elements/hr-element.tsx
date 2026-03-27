import type { PlateElementProps } from "platejs/react";
import { PlateElement, useSelected } from "platejs/react";

export function HrElement(props: PlateElementProps) {
  const selected = useSelected();

  return (
    <PlateElement {...props}>
      <div className="py-4" contentEditable={false}>
        <hr
          className={`border-t transition-colors ${
            selected
              ? "border-blue-500 dark:border-blue-400"
              : "border-zinc-200 dark:border-zinc-700"
          }`}
        />
      </div>
      {props.children}
    </PlateElement>
  );
}
