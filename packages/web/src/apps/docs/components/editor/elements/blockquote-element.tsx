import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

export function BlockquoteElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="blockquote"
      {...props}
      className="my-2 border-l-4 border-border-base pl-4 italic text-fg-muted dark:text-zinc-400"
    />
  );
}
