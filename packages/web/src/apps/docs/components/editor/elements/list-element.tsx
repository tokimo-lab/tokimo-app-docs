import type { TElement } from "platejs";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

const INDENT_WIDTH = 24;

export function ListElement({ element, ...props }: PlateElementProps) {
  const el = element as TElement & {
    indent?: number;
    listStyleType?: string;
    listStart?: number;
  };

  const indent = el.indent ?? 0;
  const listStyleType = el.listStyleType ?? "disc";
  const isOrdered =
    listStyleType === "decimal" ||
    listStyleType === "lower-alpha" ||
    listStyleType === "upper-alpha" ||
    listStyleType === "lower-roman" ||
    listStyleType === "upper-roman";

  return (
    <PlateElement
      element={element}
      {...props}
      className="py-0.5 text-zinc-900 dark:text-zinc-100"
      style={{
        paddingLeft: indent * INDENT_WIDTH,
        listStyleType,
        display: "list-item",
        marginLeft: isOrdered ? "1.5em" : "1.2em",
      }}
    />
  );
}
