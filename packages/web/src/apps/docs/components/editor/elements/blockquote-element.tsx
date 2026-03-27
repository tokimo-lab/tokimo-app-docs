import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

export function BlockquoteElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="blockquote"
      {...props}
      className="my-2 border-l-4 border-zinc-300 pl-4 italic text-zinc-600 dark:border-zinc-600 dark:text-zinc-400"
    />
  );
}
