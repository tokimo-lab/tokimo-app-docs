import type { PlateElementProps } from "platejs/react";
import { PlateElement, useElement } from "platejs/react";

export function EquationElement(props: PlateElementProps) {
  const element = useElement();
  const tex =
    ((element as Record<string, unknown>).texExpression as string) || "";

  return (
    <PlateElement
      className="my-4 flex justify-center rounded bg-zinc-50 p-4 dark:bg-zinc-900"
      {...props}
    >
      <div
        contentEditable={false}
        className="select-none font-mono text-sm text-zinc-700 dark:text-zinc-300"
      >
        {tex || "Empty equation"}
      </div>
      {props.children}
    </PlateElement>
  );
}

export function InlineEquationElement(props: PlateElementProps) {
  const element = useElement();
  const tex =
    ((element as Record<string, unknown>).texExpression as string) || "";

  return (
    <PlateElement
      as="span"
      className="inline rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm dark:bg-zinc-800"
      {...props}
    >
      <span contentEditable={false} className="select-none">
        {tex || "∅"}
      </span>
      {props.children}
    </PlateElement>
  );
}
